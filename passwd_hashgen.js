// Usage: node passwd_hashgen.js <password>
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const password = process.argv[2];
if (!password) {
    console.error('Usage: node passwd_hashgen.js <password>');
    process.exit(1);
}
console.log(hashPassword(password));
