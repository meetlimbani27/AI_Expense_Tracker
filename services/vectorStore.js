// Import required dependencies for vector storage and embeddings
import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { Document } from "@langchain/core/documents";
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables for API keys
dotenv.config();

// Set up file paths for vector store
// Using ES modules requires special handling for __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTOR_STORE_PATH = join(__dirname, '..', 'vector_store');
const VECTOR_INDEX_PATH = join(VECTOR_STORE_PATH, 'hnswlib.index');

// Create vector store directory if it doesn't exist
if (!existsSync(VECTOR_STORE_PATH)) {
    mkdirSync(VECTOR_STORE_PATH, { recursive: true });
}

/**
 * VectorStoreService class
 * Handles the storage and retrieval of expense embeddings for semantic search
 */
class VectorStoreService {
    constructor() {
        // Ensure OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required in .env file");
        }

        // Initialize OpenAI embeddings with API key
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        this.vectorStore = null;
        this.documents = [];
    }

    /**
     * Initialize the vector store
     * Either loads existing store or creates a new one
     */
    async init() {
        try {
            if (existsSync(VECTOR_INDEX_PATH)) {
                // Load existing vector store if available
                this.vectorStore = await HNSWLib.load(
                    VECTOR_STORE_PATH,
                    this.embeddings
                );
                console.log("Loaded existing vector store");
            } else {
                // Create new vector store with a dummy document
                // This is needed to initialize the store properly
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

    /**
     * Add a new expense to the vector store
     * @param {Object} expense - The expense object to add
     * @param {string} expense._id - MongoDB document ID
     * @param {number} expense.amount - Expense amount
     * @param {string} expense.category - Expense category
     * @param {Array<string>} expense.subCategory - Subcategories
     * @param {Date} expense.createdAt - Creation timestamp
     * @returns {Promise<boolean>} Success indicator
     */
    async addExpense(expense) {
        // Create metadata object for the expense
        const metadata = {
            id: expense._id.toString(),
            amount: expense.amount,
            category: expense.category,
            subCategory: expense.subCategory,
            date: expense.createdAt.toISOString()
        };

        // Create a rich text representation of the expense with clear category distinction
        // This format helps in semantic search and category separation
        const textContent = `[${expense.category.toUpperCase()}] Expense of ₹${expense.amount} for ${expense.response} 
        (Category: ${expense.category}, Subcategories: ${expense.subCategory.join(', ')}) 
        on ${expense.createdAt.toLocaleDateString()}`;

        // Create a document for vector storage
        const doc = new Document({
            pageContent: textContent,
            metadata: metadata
        });

        // Initialize vector store if needed
        if (!this.vectorStore) {
            await this.init();
        }

        // Add document to vector store and save
        await this.vectorStore.addDocuments([doc]);
        await this.vectorStore.save(VECTOR_STORE_PATH);
        
        return true;
    }

    /**
     * Search for similar expenses using semantic search
     * @param {string} query - The search query
     * @param {number} k - Number of results to return
     * @returns {Promise<Array>} Array of matching documents
     */
    async similaritySearch(query, k = 5) {
        // Initialize vector store if needed
        if (!this.vectorStore) {
            await this.init();
        }

        try {
            // Perform similarity search
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
