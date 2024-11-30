import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import readline from 'readline';
import mongoose from 'mongoose';
import Expense from './models/Expense.js';

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

// Create the chat prompt template
const prompt = ChatPromptTemplate.fromMessages([
    ["system", 'You are an AI expense analyzer. Analyze expense statements and return a JSON object with these exact fields:\n' +
    '- amount: the numeric value of the expense\n' +
    '- category: one of [Food, Transportation, Personal Care, Shopping, Entertainment, Bills]\n' +
    '- sub-category: an array with one of these based on abovecategory:\n' +
    '  * Food: ["Groceries", "Dining out", "Snacks"]\n' +
    '  * Transportation: ["Fuel", "Public transport", "Vehicle maintenance"]\n' +
    '  * Personal Care: ["Health", "Gym", "Beauty"]\n' +
    '  * Shopping: ["Clothing", "Electronics", "Household"]\n' +
    '  * Entertainment: ["Movies", "Games", "Sports"]\n' +
    '  * Bills: ["Utilities", "Phone", "Internet"]\n' +
    '- response: a brief confirmation of the expense\n\n' +
    'Return ONLY the JSON object, no additional text.'],
    ["human", "{text}"]
]);

// Create a chain with the chat prompt
const chain = new LLMChain({
    llm: model,
    prompt: prompt
});

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    while (true) {
        try {
            // Wrap readline.question in a promise
            const expense = await new Promise((resolve) => {
                rl.question('Enter your expense (or type "q" to quit): ', resolve);
            });

            // Check if user wants to exit
            if (expense.toLowerCase() === 'q') {
                console.log('Goodbye!');
                rl.close();
                await mongoose.connection.close();
                break;
            }

            // Analyze the expense
            const result = await chain.call({ text: expense });
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
            console.log('-------------------');
        } catch (error) {
            console.error("Error:", error);
        }
    }
}

main();
