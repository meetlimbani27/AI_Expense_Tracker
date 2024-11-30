# Expense Analyzer

An intelligent expense tracking system that uses AI to categorize and analyze expenses.

## Features

- Natural language expense input
- AI-powered expense categorization using OpenAI
- Automatic category and subcategory assignment
- MongoDB storage for expense tracking
- Interactive command-line interface

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

3. Create a .env file in the root directory and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

4. Make sure MongoDB is running locally on port 27017

## Usage

Start the application:
```bash
npm start
```

Enter expenses in natural language, for example:
- "spent 30 dollars on lunch today"
- "paid 45 for a movie ticket"
- "bought groceries for 85"

Type 'q' to quit the application.

## Project Structure

- `expenseAnalyzer.js` - Main application file
- `models/Expense.js` - MongoDB schema and model
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
