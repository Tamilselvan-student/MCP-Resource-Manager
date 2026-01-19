import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function fixExistingUsers() {
    try {
        console.log('🔧 Fixing existing users with default password...\n');

        // Update users with default password hash to require password change
        const defaultPasswordHash = '$2b$10$wg54GkbeWXXV5FS6GeB3lORJY1rGayouwR7Si78U1fNqv/GBf.5fu';

        const result = await pool.query(`
            UPDATE users 
            SET must_change_password = true
            WHERE password_hash = $1
              AND must_change_password = false
            RETURNING user_id, email, must_change_password;
        `, [defaultPasswordHash]);

        if (result.rows.length > 0) {
            console.log(`✅ Updated ${result.rows.length} user(s):\n`);
            result.rows.forEach(user => {
                console.log(`   - ${user.email} (${user.user_id}) → must_change_password = ${user.must_change_password}`);
            });
        } else {
            console.log('ℹ️  No users needed updating (all users already require password change or have custom passwords)');
        }

        // Show all users
        console.log('\n📋 Current user status:\n');
        const allUsers = await pool.query(`
            SELECT user_id, email, must_change_password, role
            FROM users 
            ORDER BY created_at;
        `);

        console.log('User ID\t\t\tEmail\t\t\t\tRole\t\tMust Change Password');
        console.log('─'.repeat(100));
        allUsers.rows.forEach(user => {
            console.log(`${user.user_id.padEnd(20)}\t${user.email.padEnd(30)}\t${user.role.padEnd(10)}\t${user.must_change_password}`);
        });

        await pool.end();
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
        await pool.end();
        process.exit(1);
    }
}

fixExistingUsers();
