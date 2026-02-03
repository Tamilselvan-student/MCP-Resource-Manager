
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
        console.log('🚑 Emergency Fix...');

        // 1. Sequences (Critical for inserts)
        console.log('🔹 Fixing USERS sequence...');
        await pool.query('CREATE SEQUENCE IF NOT EXISTS users_id_seq'); // independent
        await pool.query("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')");
        await pool.query("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false)");

        console.log('🔹 Fixing RESOURCES sequence...');
        await pool.query('CREATE SEQUENCE IF NOT EXISTS resources_id_seq');
        await pool.query("ALTER TABLE resources ALTER COLUMN id SET DEFAULT nextval('resources_id_seq')");
        await pool.query("SELECT setval('resources_id_seq', COALESCE((SELECT MAX(id) FROM resources), 0) + 1, false)");

        // 2. Constraints
        console.log('🔹 Attempting to add PKs...');
        try {
            await pool.query('ALTER TABLE users ADD PRIMARY KEY (id)');
            console.log('✅ Users PK added.');
        } catch (e) { console.warn('⚠️  Users PK failed (ignoring):', e.message); }

        try {
            await pool.query('ALTER TABLE resources ADD PRIMARY KEY (id)');
            console.log('✅ Resources PK added.');
        } catch (e) { console.warn('⚠️  Resources PK failed (ignoring):', e.message); }

        console.log('✅ Emergency Fix Done.');

    } catch (e) {
        console.error('❌ Fix Failed:', e);
    } finally {
        await pool.end();
    }
}
run();
