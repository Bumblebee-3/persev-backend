const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initializeDatabase, disconnectFromDatabase, School, Event, EventCategory, EventRegistration } = require('./init_db');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function resetDatabase() {
    console.log('\n🚨 DATABASE RESET UTILITY 🚨\n');
    console.log('This will COMPLETELY DELETE all data in your MongoDB database:');
    console.log('- All schools');
    console.log('- All events');
    console.log('- All event categories');
    console.log('- All event registrations');
    console.log('\nThis action CANNOT be undone!\n');

    // First confirmation
    const firstConfirm = await askQuestion('Are you sure you want to reset the database? (type "yes" to continue): ');
    
    if (firstConfirm.toLowerCase() !== 'yes') {
        console.log('❌ Database reset cancelled.');
        rl.close();
        return;
    }

    // Second confirmation
    const secondConfirm = await askQuestion('This will DELETE ALL DATA. Type "RESET" to confirm: ');
    
    if (secondConfirm !== 'RESET') {
        console.log('❌ Database reset cancelled.');
        rl.close();
        return;
    }

    // Third confirmation with database name
    const finalConfirm = await askQuestion('Final confirmation - type the database name "perseverantia-db" to proceed: ');
    
    if (finalConfirm !== 'perseverantia-db') {
        console.log('❌ Database reset cancelled.');
        rl.close();
        return;
    }

    try {
        console.log('\n🔄 Connecting to database...');
        await initializeDatabase();
        
        console.log('🗑️  Deleting all collections...');
        
        // Delete all documents from each collection
        const eventRegistrationsDeleted = await EventRegistration.deleteMany({});
        console.log(`   ✅ Deleted ${eventRegistrationsDeleted.deletedCount} event registrations`);
        
        const eventsDeleted = await Event.deleteMany({});
        console.log(`   ✅ Deleted ${eventsDeleted.deletedCount} events`);
        
        const schoolsDeleted = await School.deleteMany({});
        console.log(`   ✅ Deleted ${schoolsDeleted.deletedCount} schools`);
        
        const categoriesDeleted = await EventCategory.deleteMany({});
        console.log(`   ✅ Deleted ${categoriesDeleted.deletedCount} event categories`);
        
        console.log('\n🎉 Database has been completely reset!');
        
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        throw error;
    } finally {
        await disconnectFromDatabase();
        rl.close();
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n❌ Database reset cancelled by user.');
    rl.close();
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    resetDatabase()
        .then(() => {
            console.log('\n✅ Reset operation completed successfully!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Reset operation failed:', err);
            process.exit(1);
        });
}

module.exports = { resetDatabase };