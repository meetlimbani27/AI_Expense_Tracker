import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import readline from 'readline';
import mongoose from 'mongoose';
import Expense, { categories } from './models/Expense.js';

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
- amount: the numeric value of the expense
- category: must be one of [${Object.keys(categories).join(', ')}]
- sub-category: an array with one or more valid subcategories from this list:
${categoryText}
- response: a brief confirmation of the expense

Return ONLY the JSON object, no additional text.`;
}

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
    console.log("Analysis:", result.text);
    console.log("✅ Expense saved to database");
}

async function handleRetrieveExpense(text) {
    // This will be implemented later with semantic search
    console.log("🔍 Retrieve intent detected. Query:", text);
    console.log("💡 Retrieval functionality will be implemented with semantic search");
}

async function main() {
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
