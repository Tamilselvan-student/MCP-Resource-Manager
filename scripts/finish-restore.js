
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
        console.log('🔄 Finishing Restore...');

        // 1. Rename
        console.log('🔹 Renaming tables...');
        await pool.query('ALTER TABLE users_backup RENAME TO users');
        await pool.query('ALTER TABLE resources_backup RENAME TO resources');

        // 2. Constraints
        console.log('🔹 Applying constraints...');
        await pool.query('ALTER TABLE users ADD PRIMARY KEY (id)');
        await pool.query('ALTER TABLE users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id)');
        await pool.query('ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)');

        await pool.query('ALTER TABLE resources ADD PRIMARY KEY (id)');

        // 3. Sequences
        console.log('🔹 Fixing sequences...');

        // Users
        await pool.query('CREATE SEQUENCE IF NOT EXISTS users_id_seq OWNED BY users.id');
        await pool.query("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')");
        await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");

        // Resources
        await pool.query('CREATE SEQUENCE IF NOT EXISTS resources_id_seq OWNED BY resources.id');
        await pool.query("ALTER TABLE resources ALTER COLUMN id SET DEFAULT nextval('resources_id_seq')");
        await pool.query("SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources))");

        console.log('✅ Restore Complete!');

    } catch (e) {
        console.error('❌ Restore ERROR:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
