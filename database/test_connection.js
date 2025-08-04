const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initializeDatabase, disconnectFromDatabase } = require('./init_db');

async function testConnection() {
    console.log('🔍 Testing MongoDB Atlas connection...');
    console.log('📍 Connection URI:', process.env.MONGODB_URI ? 'Found in .env' : 'Missing from .env');
    
    try {
        console.log('⏳ Attempting to connect...');
        const startTime = Date.now();
        
        await initializeDatabase();
        
        const endTime = Date.now();
        console.log(`✅ Connection successful! (${endTime - startTime}ms)`);
        
        // Test a simple operation
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        console.log('📂 Available collections:');
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });
        
        await disconnectFromDatabase();
        console.log('✅ Connection test completed successfully!');
        
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Check your internet connection');
        console.log('2. Verify MongoDB Atlas cluster is running');
        console.log('3. Check if IP address is whitelisted');
        console.log('4. Verify credentials in .env file');
        console.log('5. Try resetting the database password');
        process.exit(1);
    }
}

if (require.main === module) {
    testConnection();
}

module.exports = { testConnection };