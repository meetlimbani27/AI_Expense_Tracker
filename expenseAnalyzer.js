// Import required dependencies
import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import readline from 'readline';
import mongoose from 'mongoose';
import Expense, { categories } from './models/Expense.js';
import vectorStore from './services/vectorStore.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB database
mongoose.connect('mongodb://localhost:27017/expense_tracker')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Initialize the language model with retry configuration
const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
    modelName: "gpt-3.5-turbo",
    maxRetries: 5,
    maxConcurrency: 1,
    timeout: 60000,
});

// Helper function to add delay between retries
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function for retrying operations with exponential backoff
async function withRetry(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (error.message.includes('rate limit') && attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 60000); // Max 1 minute delay
                console.log(`⏳ Rate limit hit. Retrying in ${delay/1000} seconds...`);
                await sleep(delay);
            } else {
                throw error;
            }
        }
    }
}

// Create traced chain with retry logic
function createTracedChain(chain, name) {
    chain.tags = [`expense_tracker_${name}`];
    return {
        call: async (params) => withRetry(() => chain.call(params))
    };
}

// Create the intent detection prompt
const intentPrompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an AI assistant that helps users track their expenses. Your task is to determine the user's intent from their message."],
    ["system", "There are only two possible intents:\n1. add - User wants to add a new expense (e.g., 'spent 500 on lunch', 'paid 1000 for groceries')\n2. retrieve - User wants to search or get information about past expenses (e.g., 'show food expenses', 'what did I spend on groceries')"],
    ["system", "Respond with ONLY ONE of these exact words: 'add' or 'retrieve'"],
    ["human", "{text}"]
]);

// Create chains for different operations with retry logic
const intentChain = createTracedChain(
    new LLMChain({
        llm: model,
        prompt: intentPrompt
    }),
    "intent_detection"
);

const expenseChain = createTracedChain(
    new LLMChain({
        llm: model,
        prompt: ChatPromptTemplate.fromMessages([
            ["system", createExpensePrompt()],
            ["human", "{text}"]
        ])
    }),
    "expense_analysis"
);

const summaryChain = createTracedChain(
    new LLMChain({
        llm: model,
        prompt: ChatPromptTemplate.fromMessages([
            ["system", "You are an AI assistant that helps summarize expense data."],
            ["system", "Given a list of expenses, provide a clear and concise summary focusing on:\n1. Total amount spent\n2. Category breakdown\n3. Notable patterns or insights"],
            ["human", "{text}"]
        ])
    }),
    "expense_summary"
);

const retrievalPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an AI assistant that helps analyze and summarize expense information.
Given a user's query and a list of relevant expenses, provide a clear and helpful response.

Guidelines:
1. Calculate total amounts when relevant
2. Group expenses by category if mentioned
3. Highlight patterns or unusual expenses
4. Keep the response concise but informative
5. Use Indian Rupee (₹) for all amounts

Example Query: "show my food expenses"
Example Expenses: 
- ₹500 for lunch at restaurant (Food)
- ₹200 for snacks (Food)
- ₹1000 for groceries (Food)

Example Response:
"I found 3 food-related expenses totaling ₹1,700. This includes ₹500 for lunch, ₹200 for snacks, and ₹1,000 for groceries."
`],
    ["human", "Query: {query}\nExpenses:\n{expenses}"]
]);

const retrievalChain = createTracedChain(
    new LLMChain({
        llm: model,
        prompt: retrievalPrompt
    }),
    "retrieval_analysis"
);

// Helper function to create expense prompt
function createExpensePrompt() {
    // Build category text from available categories
    let categoryText = 'Categories and their subcategories:\n';
    for (const [category, subcategories] of Object.entries(categories)) {
        categoryText += `- ${category}: ${JSON.stringify(subcategories)}\n`;
    }
    
    return `You are an AI expense analyzer. Analyze expense statements and return a JSON object with these exact fields:
- amount: the numeric value of the expense in Indian Rupees (₹). Extract only the number, do not include the ₹ symbol.
- category: must be one of [${Object.keys(categories).join(', ')}]. IMPORTANT: Be very specific with categorization:
  * "Food" is for prepared/restaurant meals
  * "Groceries" is for raw ingredients/household items
  * Never combine these categories even if from the same store
- sub-category: an array with one or more valid subcategories from this list:
${categoryText}
- response: a brief confirmation of the expense, mentioning the amount with ₹ symbol and being specific about the category

IMPORTANT: 
1. If the amount is given in dollars ($) or any other currency, convert it to Indian Rupees (₹) using these approximate rates:
   - 1 USD ($) = ₹83
   - 1 EUR (€) = ₹90
   - 1 GBP (£) = ₹105
2. Be very precise with categories. For stores like DMart that sell multiple categories:
   - If buying prepared food/meals, categorize as "Food"
   - If buying groceries/ingredients, categorize as "Groceries"
   - Never combine these categories

Return ONLY the JSON object, no additional text.`;
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

// Main processing function with tracing and retry logic
async function processUserInput(input) {
    try {
        // Detect intent with retry
        const intentResult = await intentChain.call({ text: input });
        const intent = intentResult.text.toLowerCase().trim();

        // Process based on intent
        switch (intent) {
            case 'add': {
                console.log('💭 Understanding your expense...');
                const analysis = await expenseChain.call({ text: input });
                const expenseData = JSON.parse(analysis.text);
                
                // Create and save expense
                const expense = new Expense({
                    amount: expenseData.amount,
                    category: expenseData.category,
                    subCategory: expenseData['sub-category'] || [],
                    response: expenseData.response
                });
                
                await expense.save();
                await vectorStore.addExpense(expense);
                
                console.log('✅ Expense saved:');
                console.log(`   Amount: ${formatCurrency(expense.amount)}`);
                console.log(`   Category: ${expense.category}`);
                if (expense.subCategory && expense.subCategory.length > 0) {
                    console.log(`   Subcategories: ${expense.subCategory.join(', ')}`);
                }
                console.log(`   Description: ${expense.response}`);
                break;
            }
            case 'retrieve': {
                console.log('🔍 Analyzing your expenses...');
                // First, get relevant expenses using vector search
                const results = await vectorStore.similaritySearch(input);
                
                if (results.length === 0) {
                    console.log('❌ No matching expenses found.');
                    break;
                }

                // Format expenses for the analysis
                const expensesText = results.map(r => r.pageContent).join('\n');
                
                // Generate analysis of the expenses
                const analysis = await retrievalChain.call({
                    query: input,
                    expenses: expensesText
                });
                
                console.log('\n📊 ' + analysis.text);
                break;
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Create readline interface for CLI interaction
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('👋 Welcome to your AI Expense Tracker!');
console.log('You can:');
console.log('  - Add expenses (e.g., "spent 500 on lunch")');
console.log('  - Ask about expenses (e.g., "show me food expenses", "what did I spend on groceries last week?")');
console.log('\nEnter your request (or type "q" to quit):');

rl.on('line', async (input) => {
    if (input.toLowerCase() === 'q') {
        console.log('👋 Goodbye!');
        rl.close();
        process.exit(0);
    }
    await processUserInput(input);
    console.log('\nEnter your request (or type "q" to quit):');
});
