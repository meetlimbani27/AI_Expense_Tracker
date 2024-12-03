# Expense Analyzer

An intelligent expense tracking system that uses AI to categorize and analyze expenses with semantic search capabilities.

## Features

- Natural language expense input
- AI-powered expense categorization using OpenAI
- Semantic search for expenses using vector embeddings
- Automatic category and subcategory assignment
- MongoDB storage for expense tracking
- Interactive command-line interface

## Vector Store Implementations

This project offers two different vector store implementations for semantic search functionality:

### 1. HNSWLib Implementation (Default)
Available in branches: `master` and `hnswlib_vectorstore`

**Features:**
- Lightweight, file-based vector storage
- Fast approximate nearest neighbor search
- Runs completely locally without external dependencies
- Perfect for development and smaller datasets
- Lower resource requirements

**Additional Requirements:**
- None (included in package.json)

**Setup:**
```bash
# Use either master or hnswlib_vectorstore branch
git checkout master  # or git checkout hnswlib_vectorstore
npm install
```

### 2. Qdrant Implementation
Available in branch: `qdrant_vectorstore`

**Features:**
- Production-ready vector database
- Highly scalable and distributed
- Advanced filtering and search capabilities
- Better for larger datasets
- Supports cloud deployment

**Additional Requirements:**
- Qdrant server or Qdrant Cloud account
- Qdrant API key (for cloud deployment)

**Setup:**
```bash
# Switch to Qdrant implementation
git checkout qdrant_vectorstore
npm install

# Add to your .env file:
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key
```

## LangSmith Tracing

This project includes LangSmith integration for monitoring and debugging LangChain applications. LangSmith provides:
- Detailed traces of all LangChain runs
- Debug information for prompts and completions
- Performance metrics and token usage
- Feedback and evaluation tools

### Setting up LangSmith

1. Create a LangSmith account at [cloud.langsmith.com](https://cloud.langsmith.com)

2. Add these environment variables to your `.env` file:
```bash
# Required for all implementations
OPENAI_API_KEY=your_openai_api_key

# LangSmith Configuration
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY=your_langsmith_api_key
LANGCHAIN_PROJECT=your_project_name  # Optional, defaults to "default"

# Additional keys for Qdrant implementation (if using qdrant_vectorstore branch)
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key
```

3. Access your traces:
   - Go to [cloud.langsmith.com](https://cloud.langsmith.com)
   - Navigate to your project
   - View detailed traces of your runs

### What's Being Traced

The following operations are traced in LangSmith:
- Expense categorization chains
- Intent detection
- Vector store operations
- Expense summarization
- All LLM calls and their responses

This helps in:
- Debugging incorrect categorizations
- Optimizing prompt performance
- Monitoring token usage
- Improving response quality

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally)
- OpenAI API key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd expense-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Create a .env file in the root directory and add required keys:
```bash
# Required for all implementations
OPENAI_API_KEY=your_openai_api_key

# LangSmith Configuration
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY=your_langsmith_api_key
LANGCHAIN_PROJECT=your_project_name  # Optional, defaults to "default"

# Additional keys for Qdrant implementation (if using qdrant_vectorstore branch)
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key
```

4. Make sure MongoDB is running locally on port 27017

## Usage

Start the application:
```bash
npm start
```

### Adding Expenses
Enter expenses in natural language, for example:
- "spent 30 dollars on lunch today"
- "paid 45 for a movie ticket"
- "bought groceries for 85"

### Searching Expenses
Use natural language queries to search your expenses:
- "show me all food expenses"
- "what did I spend on entertainment last month"
- "find grocery expenses above 50 dollars"

Type 'q' to quit the application.

## Project Structure

- `expenseAnalyzer.js` - Main application file
- `models/Expense.js` - MongoDB schema and model
- `services/vectorStore.js` - Vector store implementation
- `vector_store/` - Vector storage data directory
- `.env` - Environment variables (not tracked in git)
- `package.json` - Project dependencies and scripts

## Categories

The system supports the following expense categories:

- Food: [Groceries, Dining out, Snacks]
- Transportation: [Fuel, Public transport, Vehicle maintenance]
- Personal Care: [Health, Gym, Beauty]
- Shopping: [Clothing, Electronics, Household]
- Entertainment: [Movies, Games, Sports]
- Bills: [Utilities, Phone, Internet]

## Choosing the Right Implementation

- Choose **HNSWLib** (master branch) if you:
  - Want a simple, local setup
  - Are in development/testing phase
  - Have a smaller dataset (< 100k expenses)
  - Don't need distributed deployment

- Choose **Qdrant** (qdrant_vectorstore branch) if you:
  - Need production-grade deployment
  - Have a large dataset (> 100k expenses)
  - Require advanced filtering capabilities
  - Need horizontal scalability
  - Want managed cloud deployment
