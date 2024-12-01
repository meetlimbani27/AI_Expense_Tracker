import vectorStore from './services/vectorStore.js';

async function testVectorStore() {
    try {
        // Test initialization
        await vectorStore.init();
        console.log('✅ Successfully initialized vector store');

        // Test adding an expense
        const testExpense = {
            _id: 'test123',
            amount: 1000,
            category: 'Food',
            subCategory: ['Restaurant', 'Dinner'],
            response: 'dinner at a restaurant',
            createdAt: new Date()
        };
        
        await vectorStore.addExpense(testExpense);
        console.log('✅ Successfully added test expense');

        // Test similarity search
        const results = await vectorStore.similaritySearch('food expenses');
        console.log('✅ Successfully performed similarity search');
        console.log('Search results:', results);

        // Cleanup - delete test expense
        await vectorStore.deleteExpense('test123');
        console.log('✅ Successfully deleted test expense');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testVectorStore();
