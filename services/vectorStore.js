import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { Document } from "@langchain/core/documents";
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get directory name for the current module
const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTOR_STORE_PATH = join(__dirname, '..', 'vector_store');
const VECTOR_INDEX_PATH = join(VECTOR_STORE_PATH, 'hnswlib.index');

// Ensure vector store directory exists
if (!existsSync(VECTOR_STORE_PATH)) {
    mkdirSync(VECTOR_STORE_PATH, { recursive: true });
}

class VectorStoreService {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required in .env file");
        }
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        this.vectorStore = null;
        this.documents = [];
    }

    async init() {
        try {
            if (existsSync(VECTOR_INDEX_PATH)) {
                // Load existing vector store
                this.vectorStore = await HNSWLib.load(
                    VECTOR_STORE_PATH,
                    this.embeddings
                );
                console.log("Loaded existing vector store");
            } else {
                // Create a new vector store with a dummy document to initialize
                const dummyDoc = new Document({
                    pageContent: "Initialization document",
                    metadata: { initialization: true }
                });
                
                this.vectorStore = await HNSWLib.fromDocuments(
                    [dummyDoc],
                    this.embeddings
                );
                await this.vectorStore.save(VECTOR_STORE_PATH);
                console.log("Created new vector store");
            }
        } catch (error) {
            console.error("Error initializing vector store:", error);
            throw error;
        }
    }

    async addExpense(expense) {
        const metadata = {
            id: expense._id.toString(),
            amount: expense.amount,
            category: expense.category,
            subCategory: expense.subCategory,
            date: expense.createdAt.toISOString()
        };

        // Create a rich text representation of the expense with clear category distinction
        const textContent = `[${expense.category.toUpperCase()}] Expense of ₹${expense.amount} for ${expense.response} 
        (Category: ${expense.category}, Subcategories: ${expense.subCategory.join(', ')}) 
        on ${expense.createdAt.toLocaleDateString()}`;

        const doc = new Document({
            pageContent: textContent,
            metadata: metadata
        });

        if (!this.vectorStore) {
            await this.init();
        }

        // Add to vector store
        await this.vectorStore.addDocuments([doc]);
        await this.vectorStore.save(VECTOR_STORE_PATH);
        
        return true;
    }

    async similaritySearch(query, k = 5) {
        if (!this.vectorStore) {
            await this.init();
        }

        try {
            const results = await this.vectorStore.similaritySearch(query, k);
            // Filter out the initialization document if it exists
            return results.filter(doc => !doc.metadata?.initialization);
        } catch (error) {
            console.error("Error during similarity search:", error);
            return [];
        }
    }
}

// Create and export a singleton instance
const vectorStore = new VectorStoreService();
export default vectorStore;
