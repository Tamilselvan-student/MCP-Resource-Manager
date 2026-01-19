import { hashPassword } from './auth/password.js';
import pool from './database.js';
async function fixPasswords() {
    try {
        console.log('🔧 Fixing password hashes for all users...');
        // Generate correct hash for "changeme123"
        const correctHash = await hashPassword('changeme123');
        console.log('✓ Generated correct hash for password: changeme123');
        console.log(`✓ Hash: ${correctHash.substring(0, 20)}...`);
        // Update ALL users with the correct hash and disable password change
        const result = await pool.query('UPDATE users SET password_hash = $1, must_change_password = false', [correctHash]);
        console.log(`✓ Updated ${result.rowCount} user password hashes`);
        // Verify the users
        const users = await pool.query('SELECT user_id, email, username FROM users ORDER BY username');
        console.log('\n✓ Users in database:');
        users.rows.forEach((u) => {
            console.log(`  - ${u.email} (${u.username})`);
        });
        console.log('\n✅ Password fix complete!');
        console.log('📝 Default credentials: {email} / changeme123');
        console.log('   Example: tharsan@example.com / changeme123');
        await pool.end();
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error fixing passwords:', error);
        process.exit(1);
    }
}
fixPasswords();
