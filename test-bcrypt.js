// Test bcrypt hash verification
import bcrypt from 'bcrypt';

const password = 'changeme123';
const hash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

console.log('Testing bcrypt...');
console.log('Password:', password);
console.log('Hash:', hash);

bcrypt.compare(password, hash).then(result => {
    console.log('Match:', result);
    if (result) {
        console.log('✅ Password matches!');
    } else {
        console.log('❌ Password does NOT match');

        // Try generating a new hash
        bcrypt.hash(password, 10).then(newHash => {
            console.log('\nNew hash generated:', newHash);
            bcrypt.compare(password, newHash).then(newResult => {
                console.log('New hash matches:', newResult);
            });
        });
    }
}).catch(err => {
    console.error('Error:', err);
});
