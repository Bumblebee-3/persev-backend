#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// File paths
const SCHOOL_CONFIG_PATH = path.join(__dirname, 'school_config.json');
const ENV_PATH = path.join(__dirname, '.env');

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function loadSchoolConfig() {
    try {
        if (fs.existsSync(SCHOOL_CONFIG_PATH)) {
            const data = fs.readFileSync(SCHOOL_CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading school config:', error.message);
    }
    return { schools: [] };
}

function saveSchoolConfig(config) {
    try {
        fs.writeFileSync(SCHOOL_CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log('✅ School configuration saved successfully!');
    } catch (error) {
        console.error('❌ Error saving school config:', error.message);
    }
}

function updateEnvFile(config) {
    try {
        // Read current .env file
        let envContent = '';
        if (fs.existsSync(ENV_PATH)) {
            envContent = fs.readFileSync(ENV_PATH, 'utf8');
        }

        // Extract usernames and hashed passwords from school config
        const usernames = config.schools.map(school => school.username);
        const hashedPasswords = config.schools.map(school => school.password); // Already hashed

        // Update or add UNAMES and PASSWORDS lines
        const unamesLine = `UNAMES = ${usernames.join(',')}`;
        const passwordsLine = `PASSWORDS = ${hashedPasswords.join(',')}`;

        // Replace existing lines or add new ones
        const lines = envContent.split('\n');
        let unamesUpdated = false;
        let passwordsUpdated = false;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('UNAMES ')) {
                lines[i] = unamesLine;
                unamesUpdated = true;
            } else if (lines[i].startsWith('PASSWORDS ')) {
                lines[i] = passwordsLine;
                passwordsUpdated = true;
            }
        }

        // Add lines if they don't exist
        if (!unamesUpdated) {
            lines.splice(1, 0, unamesLine); // Add after first line
        }
        if (!passwordsUpdated) {
            lines.splice(2, 0, passwordsLine); // Add after UNAMES line
        }

        fs.writeFileSync(ENV_PATH, lines.join('\n'));
        console.log('✅ .env file updated successfully!');
    } catch (error) {
        console.error('❌ Error updating .env file:', error.message);
    }
}

function displayUsers(config) {
    console.log('\n📋 Current Users:');
    console.log('==================');
    if (config.schools.length === 0) {
        console.log('No users found.');
        return;
    }

    config.schools.forEach((school, index) => {
        console.log(`${index + 1}. Username: ${school.username}`);
        console.log(`   School: ${school.schoolName}`);
        console.log(`   Code: ${school.schoolCode}`);
        console.log(`   Password Hash: ${school.password}`);
        console.log('');
    });
}

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function addUser(config) {
    console.log('\n➕ Add New User');
    console.log('================');

    const schoolName = await askQuestion('Enter school name: ');
    if (!schoolName) {
        console.log('❌ School name cannot be empty!');
        return;
    }

    const schoolCode = await askQuestion('Enter school code (will be used as username): ');
    if (!schoolCode) {
        console.log('❌ School code cannot be empty!');
        return;
    }

    // Check if username already exists
    if (config.schools.find(school => school.username === schoolCode)) {
        console.log('❌ Username already exists!');
        return;
    }

    const password = await askQuestion('Enter password: ');
    if (!password) {
        console.log('❌ Password cannot be empty!');
        return;
    }

    const newUser = {
        username: schoolCode,
        schoolName: schoolName,
        schoolCode: schoolCode,
        password: password // Store hashed password
    };

    config.schools.push(newUser);
    
    console.log('\n✅ User added successfully!');
    console.log(`Username: ${newUser.username}`);
    console.log(`School: ${newUser.schoolName}`);
    console.log(`Original Password: ${password}`);
    console.log(`Stored Hash: ${newUser.password}`);

    saveSchoolConfig(config);
    updateEnvFile(config);
}

async function modifyUser(config) {
    console.log('\n✏️  Modify User');
    console.log('===============');

    if (config.schools.length === 0) {
        console.log('❌ No users available to modify!');
        return;
    }

    displayUsers(config);

    const indexStr = await askQuestion('Enter user number to modify: ');
    const index = parseInt(indexStr) - 1;

    if (isNaN(index) || index < 0 || index >= config.schools.length) {
        console.log('❌ Invalid user number!');
        return;
    }

    const user = config.schools[index];
    console.log(`\nModifying user: ${user.username}`);

    const newSchoolName = await askQuestion(`Enter new school name (current: ${user.schoolName}): `);
    const newPassword = await askQuestion(`Enter new password (current: ${user.password}): `);

    if (newSchoolName) {
        user.schoolName = newSchoolName;
    }
    if (newPassword) {
        user.password = hashPassword(newPassword); // Store hashed password
    }

    console.log('\n✅ User modified successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`School: ${user.schoolName}`);
    if (newPassword) {
        console.log(`New Password: ${newPassword}`);
        console.log(`Stored Hash: ${user.password}`);
    }

    saveSchoolConfig(config);
    updateEnvFile(config);
}

async function removeUser(config) {
    console.log('\n🗑️  Remove User');
    console.log('===============');

    if (config.schools.length === 0) {
        console.log('❌ No users available to remove!');
        return;
    }

    displayUsers(config);

    const indexStr = await askQuestion('Enter user number to remove: ');
    const index = parseInt(indexStr) - 1;

    if (isNaN(index) || index < 0 || index >= config.schools.length) {
        console.log('❌ Invalid user number!');
        return;
    }

    const user = config.schools[index];
    const confirm = await askQuestion(`Are you sure you want to remove user "${user.username}" (${user.schoolName})? (y/N): `);

    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
        config.schools.splice(index, 1);
        console.log('✅ User removed successfully!');
        
        saveSchoolConfig(config);
        updateEnvFile(config);
    } else {
        console.log('❌ Operation cancelled.');
    }
}

async function showMainMenu() {
    console.log('\n🎓 School Account Manager');
    console.log('==========================');
    console.log('1. View all users');
    console.log('2. Add new user');
    console.log('3. Modify existing user');
    console.log('4. Remove user');
    console.log('5. Generate password hash');
    console.log('6. Exit');
    console.log('');

    const choice = await askQuestion('Select an option (1-6): ');
    return choice;
}

async function generatePasswordHash() {
    console.log('\n🔐 Generate Password Hash');
    console.log('=========================');
    
    const password = await askQuestion('Enter password to hash: ');
    if (!password) {
        console.log('❌ Password cannot be empty!');
        return;
    }

    const hash = hashPassword(password);
    console.log(`\n✅ Password: ${password}`);
    console.log(`✅ SHA256 Hash: ${hash}`);
}

async function main() {
    console.log('🚀 Starting School Account Manager...\n');

    // Check if running with command line arguments (legacy mode)
    if (process.argv[2]) {
        const password = process.argv[2];
        console.log(`Password: ${password}`);
        console.log(`SHA256 Hash: ${hashPassword(password)}`);
        process.exit(0);
    }

    const config = loadSchoolConfig();

    while (true) {
        try {
            const choice = await showMainMenu();

            switch (choice) {
                case '1':
                    displayUsers(config);
                    break;
                case '2':
                    await addUser(config);
                    break;
                case '3':
                    await modifyUser(config);
                    break;
                case '4':
                    await removeUser(config);
                    break;
                case '5':
                    await generatePasswordHash();
                    break;
                case '6':
                    console.log('\n👋 Goodbye!');
                    rl.close();
                    process.exit(0);
                    break;
                default:
                    console.log('❌ Invalid option. Please select 1-6.');
            }

            // Wait for user to press enter before showing menu again
            await askQuestion('\nPress Enter to continue...');
        } catch (error) {
            console.error('❌ An error occurred:', error.message);
        }
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    rl.close();
    process.exit(0);
});

// Start the application
main().catch(console.error);
