
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
        console.log('🔄 Starting Rename Restore...');
        await pool.query('BEGIN');

        // 1. Cleanup target tables
        await pool.query('DROP TABLE IF EXISTS users CASCADE');
        await pool.query('DROP TABLE IF EXISTS resources CASCADE');

        // 2. Rename Backups
        console.log('🔹 Renaming users_backup -> users...');
        await pool.query('ALTER TABLE users_backup RENAME TO users');

        console.log('🔹 Renaming resources_backup -> resources...');
        await pool.query('ALTER TABLE resources_backup RENAME TO resources');

        // 3. Apply Constraints - USERS
        console.log('🔹 Applying constraints to users...');
        await pool.query('ALTER TABLE users ADD PRIMARY KEY (id)');
        await pool.query('ALTER TABLE users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id)');
        await pool.query('ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)');

        // 4. Apply Constraints - RESOURCES
        console.log('🔹 Applying constraints to resources...');
        await pool.query('ALTER TABLE resources ADD PRIMARY KEY (id)');

        // 5. Fix Sequences (Auto-Increment)
        console.log('🔹 Fixing sequences...');

        // Users Sequence
        await pool.query('DROP SEQUENCE IF EXISTS users_id_seq CASCADE');
        await pool.query('CREATE SEQUENCE users_id_seq OWNED BY users.id');
        await pool.query("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')");
        await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");

        // Resources Sequence
        await pool.query('DROP SEQUENCE IF EXISTS resources_id_seq CASCADE');
        await pool.query('CREATE SEQUENCE resources_id_seq OWNED BY resources.id');
        await pool.query("ALTER TABLE resources ALTER COLUMN id SET DEFAULT nextval('resources_id_seq')");
        await pool.query("SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources))");

        await pool.query('COMMIT');

        console.log('✅ Restoration Complete via Rename!');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('❌ Restore ERROR:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
