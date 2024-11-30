import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    amount: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Food', 'Transportation', 'Personal Care', 'Shopping', 'Entertainment', 'Bills']
    },
    subCategory: {
        type: [String],
        required: true,
        validate: {
            validator: function(subcats) {
                const validSubcategories = {
                    'Food': ['Groceries', 'Dining out', 'Snacks'],
                    'Transportation': ['Fuel', 'Public transport', 'Vehicle maintenance'],
                    'Personal Care': ['Health', 'Gym', 'Beauty'],
                    'Shopping': ['Clothing', 'Electronics', 'Household'],
                    'Entertainment': ['Movies', 'Games', 'Sports'],
                    'Bills': ['Utilities', 'Phone', 'Internet']
                };
                return subcats.every(subcat => 
                    validSubcategories[this.category]?.includes(subcat)
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

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
