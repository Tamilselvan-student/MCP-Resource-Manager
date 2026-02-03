import bcrypt from 'bcrypt';

const storedHash = '$2b$10$6niS6VIaOFYVgq8AgnNad./I9FPsJBw1dDMSN071Aog9dkoQA6wSK';
const testPasswords = [
    'Tharsan@123',
    'changeme123',
    'password',
    'admin123',
    'test123',
    'Password123',
    'Admin@123',
    'admin',
    'Admin123',
    'temporary_password_hash'
];

console.log('🔍 Testing which password matches admin user hash...\n');

for (const pwd of testPasswords) {
    try {
        const match = await bcrypt.compare(pwd, storedHash);
        if (match) {
            console.log(`✅ FOUND IT! Password is: "${pwd}"`);
            break;
        }
    } catch (err) {
        // ignore
    }
}

console.log('\n❌ None of the common passwords matched.');
console.log('The admin user needs a password reset.');
