
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
        const res = await pool.query('SELECT id, resource_type FROM resources LIMIT 5');
        console.table(res.rows);
        console.log('✅ READ SUCCESS');
    } catch (e) {
        console.error('❌ READ FAILED:', e);
    } finally {
        await pool.end();
    }
}
run();
