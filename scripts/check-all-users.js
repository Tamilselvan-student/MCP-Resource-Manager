import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mcp_resources',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});

async function checkUsers() {
    try {
        console.log('📋 Checking all users in database...\n');

        const result = await pool.query(`
            SELECT 
                id,
                user_id,
                username,
                email,
                role,
                is_active,
                must_change_password,
                created_at,
                LENGTH(password_hash) as hash_length
            FROM users
            ORDER BY created_at DESC
        `);

        console.log(`Found ${result.rows.length} user(s):\n`);
        result.rows.forEach((user, index) => {
            console.log(`User ${index + 1}:`);
            console.log(JSON.stringify(user, null, 2));
            console.log('---');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

checkUsers();
