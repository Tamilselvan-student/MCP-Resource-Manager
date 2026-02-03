import bcrypt from 'bcrypt';
import bcryptjs from 'bcryptjs';

const storedHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const testPasswords = [
    'Tharsan@123',
    'changeme123',
    'password',
    'admin123',
    'test123',
    'Password123',
    'Admin@123'
];

console.log('🔍 Testing which password matches the stored hash...\n');
console.log('Stored hash:', storedHash);
console.log('\n');

for (const pwd of testPasswords) {
    try {
        const match = await bcrypt.compare(pwd, storedHash);
        console.log(`Password "${pwd}": ${match ? '✅ MATCH!' : '❌ no match'}`);

        if (match) {
            console.log(`\n🎉 FOUND IT! The password is: "${pwd}"`);
        }
    } catch (err) {
        console.log(`Password "${pwd}": ❌ error - ${err.message}`);
    }
}
