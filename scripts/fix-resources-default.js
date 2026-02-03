
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
        console.log('🔧 Fixing Resources Default...');

        // Ensure pgcrypto or just try native
        await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

        await pool.query("ALTER TABLE resources ALTER COLUMN id SET DEFAULT gen_random_uuid()");

        console.log('✅ Default set to gen_random_uuid()');

    } catch (e) {
        console.error('❌ Fix Failed:', e);
    } finally {
        await pool.end();
    }
}
run();
