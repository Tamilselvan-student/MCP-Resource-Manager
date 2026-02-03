
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
        console.log('🧪 Attempting to create resource...');
        const res = await pool.query(`
            INSERT INTO resources (resource_type, data, created_by)
            VALUES ($1, $2, $3)
            RETURNING *
        `, ['note', { content: 'debug test' }, 'user:debug']);

        console.log('✅ Success:', res.rows[0]);
    } catch (e) {
        console.error('❌ Failed:', e);
    } finally {
        await pool.end();
    }
}
run();
