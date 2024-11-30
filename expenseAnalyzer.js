import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import readline from 'readline';
import mongoose from 'mongoose';
import Expense, { categories } from './models/Expense.js';
import vectorStore from './services/vectorStore.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/expense_tracker')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Initialize the OpenAI chat model
const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
    modelName: "gpt-3.5-turbo"
});

// Create the intent detection prompt
const intentPrompt = ChatPromptTemplate.fromMessages([
    ["system", 'You are an AI intent detector for an expense tracking system. Your task is to determine if the user wants to add a new expense or retrieve/search existing expenses.\n\n' +
    'For adding expenses, look for phrases like:\n' +
    '- "I spent..."\n' +
    '- "paid for..."\n' +
    '- "bought..."\n' +
    '- Any mention of amounts or costs\n\n' +
    'For retrieving expenses, look for phrases like:\n' +
    '- "show me..."\n' +
    '- "find..."\n' +
    '- "what did I spend..."\n' +
    '- "search for..."\n' +
    '- Questions about past expenses\n\n' +
    'Return a JSON object with these exact fields:\n' +
    '- intent: either "add" or "retrieve"\n' +
    '- confidence: a number between 0 and 1\n' +
    '- originalText: the input text\n\n' +
    'Return ONLY the JSON, no additional text.'],
    ["human", "{text}"]
]);

// Create the expense analysis prompt
function createExpensePrompt() {
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

// Create summary prompt for search results
const summaryPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an AI assistant that summarizes expense search results.
Given a user's query and a list of relevant expenses, provide a concise and informative summary.

IMPORTANT RULES:
1. Separate expenses by category - never combine amounts from different categories
2. If searching for a specific category (e.g., "food"), only include expenses from that exact category
3. For each category mentioned in the query:
   - Show the total amount spent in that category
   - List individual expenses within that category
4. All amounts should be in Indian Rupees (₹)
5. If a store sells multiple categories (e.g., DMart selling both food and groceries):
   - Treat each category separately
   - Do not combine amounts across categories
   - Clearly indicate which expenses belong to which category

Example Summary Format:
"For [category]:
- Total spent: ₹X
- Individual expenses:
  * ₹A at [place] on [date]
  * ₹B at [place] on [date]

For [another category]:
- Total spent: ₹Y
- Individual expenses:
  * ₹C at [place] on [date]"

Keep the summary clear, organized by category, and never mix expenses from different categories.`],
    ["human", `Query: {query}
Relevant expenses:
{expenses}

Provide a summary of these expenses, strictly separating different categories:`]
]);

// Create the chains
const intentChain = new LLMChain({
    llm: model,
    prompt: intentPrompt
});

const expenseChain = new LLMChain({
    llm: model,
    prompt: ChatPromptTemplate.fromMessages([
        ["system", createExpensePrompt()],
        ["human", "{text}"]
    ])
});

const summaryChain = new LLMChain({
    llm: model,
    prompt: summaryPrompt
});

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function handleAddExpense(text) {
    const result = await expenseChain.call({ text });
    const expenseData = JSON.parse(result.text);

    // Create and save the expense in MongoDB
    const newExpense = new Expense({
        amount: expenseData.amount,
        category: expenseData.category,
        subCategory: expenseData['sub-category'],
        response: expenseData.response
    });

    await newExpense.save();
    
    // Add to vector store
    await vectorStore.addExpense(newExpense);
    
    console.log("Analysis:", result.text);
    console.log("✅ Expense saved to database and vector store");
}

async function handleRetrieveExpense(text) {
    console.log("🔍 Searching expenses...");
    
    // Search in vector store
    const searchResults = await vectorStore.similaritySearch(text);
    
    if (searchResults.length === 0) {
        console.log("❌ No relevant expenses found");
        return;
    }

    // Format expenses for summary
    const expensesText = searchResults
        .map(doc => doc.pageContent)
        .join('\n');

    // Generate summary
    const summary = await summaryChain.call({
        query: text,
        expenses: expensesText
    });

    console.log("\n📊 Summary:");
    console.log(summary.text);
    
    console.log("\n📝 Relevant Expenses:");
    searchResults.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.pageContent}`);
    });
}

async function main() {
    // Initialize vector store
    await vectorStore.init();
    console.log("✅ Vector store initialized");

    while (true) {
        try {
            // Wrap readline.question in a promise
            const userInput = await new Promise((resolve) => {
                rl.question('Enter your request (or type "q" to quit): ', resolve);
            });

            // Check if user wants to exit
            if (userInput.toLowerCase() === 'q') {
                console.log('Goodbye!');
                rl.close();
                await mongoose.connection.close();
                break;
            }

            // First, detect the intent
            const intentResult = await intentChain.call({ text: userInput });
            const { intent, confidence } = JSON.parse(intentResult.text);
            
            console.log(`🤖 Detected intent: ${intent} (confidence: ${(confidence * 100).toFixed(1)}%)`);

            // Handle the intent
            if (intent === 'add') {
                await handleAddExpense(userInput);
            } else {
                await handleRetrieveExpense(userInput);
            }
            
            console.log('-------------------');
        } catch (error) {
            console.error("Error:", error);
        }
    }
}

main();
