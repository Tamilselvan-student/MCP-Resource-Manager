// Generate correct bcrypt hash for changeme123
import bcrypt from 'bcrypt';

const password = 'changeme123';

bcrypt.hash(password, 10).then(hash => {
    console.log('Password:', password);
    console.log('Bcrypt hash (copy this):');
    console.log(hash);

    // Verify it works
    bcrypt.compare(password, hash).then(result => {
        console.log('\nVerification:', result ? '✅ Works!' : '❌ Failed');
    });
});
