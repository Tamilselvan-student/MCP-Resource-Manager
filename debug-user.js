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

async function debugUser(username) {
    try {
        console.log(`\n=== DEBUGGING USER: ${username} ===\n`);

        // Query user data
        const result = await pool.query(
            'SELECT id, user_id, username, email, role, is_active, created_at FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            console.log('❌ User not found!');
            return;
        }

        const user = result.rows[0];

        console.log('📊 User Data:');
        console.log('  id (integer):', user.id);
        console.log('  user_id (string):', user.user_id);
        console.log('  username:', user.username);
        console.log('  email:', user.email);
        console.log('  role:', user.role);
        console.log('  is_active:', user.is_active);
        console.log('  created_at:', user.created_at);

        console.log('\n🔍 Checks:');
        console.log('  user_id has "user:" prefix?', user.user_id.startsWith('user:'));
        console.log('  user_id format:', user.user_id.includes(':') ? 'CORRECT (has colon)' : 'WRONG (no colon)');

        console.log('\n✅ Expected OpenFGA tuple format:');
        console.log(JSON.stringify({
            user: user.user_id,
            relation: user.role === 'viewer' ? 'viewer' : user.role === 'editor' ? 'editor' : 'owner',
            object: 'resource:file_*'
        }, null, 2));

        console.log('\n=== END DEBUG ===\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Get username from command line or use default
const username = process.argv[2] || 'watersheep';
debugUser(username);
