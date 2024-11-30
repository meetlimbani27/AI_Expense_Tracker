import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and parse categories from cat_data.txt
const catDataPath = path.join(__dirname, '..', 'cat_data.txt');
const catData = fs.readFileSync(catDataPath, 'utf8');

// Parse categories and subcategories
function parseCategoryData(data) {
    const categories = {};
    let currentCategory = null;
    
    data.split('\n').forEach(line => {
        // Skip empty lines and the "Expense Categories:" header
        if (!line.trim() || line.includes('Expense Categories:')) return;
        
        // Check if it's a main category (starts with number)
        const categoryMatch = line.match(/^\d+\.\s+(.+)/);
        if (categoryMatch) {
            currentCategory = categoryMatch[1].trim();
            categories[currentCategory] = [];
        } else if (currentCategory && line.trim().startsWith('-')) {
            // It's a subcategory
            const subcategory = line.replace('-', '').trim();
            categories[currentCategory].push(subcategory);
        }
    });
    
    return categories;
}

const categoryData = parseCategoryData(catData);
const validCategories = Object.keys(categoryData);

const expenseSchema = new mongoose.Schema({
    amount: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: validCategories
    },
    subCategory: {
        type: [String],
        required: true,
        validate: {
            validator: function(subcats) {
                const validSubcategories = categoryData[this.category] || [];
                return subcats.every(subcat => 
                    validSubcategories.includes(subcat)
                );
            },
            message: 'Invalid subcategory for the selected category'
        }
    },
    response: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Export both the model and the parsed categories
export const categories = categoryData;
const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
