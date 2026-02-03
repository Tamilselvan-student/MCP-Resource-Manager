
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import 'dotenv/config';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function run() {
    try {
        console.log('🧪 Attempting to create user...');
        const res = await pool.query(`
            INSERT INTO users (user_id, username, email, password_hash, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, ['user:debug_new', 'debug_new', 'debug_new@example.com', 'hash', 'viewer']);

        console.log('✅ Success:', res.rows[0]);

        // Clean up
        await pool.query('DELETE FROM users WHERE id = $1', [res.rows[0].id]);

    } catch (e) {
        console.error('❌ Failed:', e);
    } finally {
        await pool.end();
    }
}
run();
