
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
        console.log('🔄 Fixing Constraints (Copy Method)...');
        await pool.query('BEGIN');

        // USERS
        // Create new table with correct schema
        await pool.query('DROP TABLE IF EXISTS users_final CASCADE');
        await pool.query(`
            CREATE TABLE users_final (
              id SERIAL PRIMARY KEY,
              user_id TEXT UNIQUE NOT NULL,
              username TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL,
              must_change_password BOOLEAN DEFAULT TRUE,
              is_active BOOLEAN DEFAULT TRUE,
              last_login TIMESTAMP,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Copy Data
        // Map columns carefully. users table (renamed from backup) has same columns?
        // We verified backup cols earlier.
        await pool.query(`
            INSERT INTO users_final (id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at)
            SELECT id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at
            FROM users
        `);

        // Swap
        await pool.query('DROP TABLE users CASCADE');
        await pool.query('ALTER TABLE users_final RENAME TO users');

        // RESOURCES
        await pool.query('DROP TABLE IF EXISTS resources_final CASCADE');
        await pool.query(`
            CREATE TABLE resources_final (
              id SERIAL PRIMARY KEY,
              resource_type TEXT NOT NULL,
              data JSONB NOT NULL,
              created_by TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT NOW(),
              visible_to_owner BOOLEAN DEFAULT TRUE,
              visible_to_admin BOOLEAN DEFAULT TRUE,
              visible_to_editor BOOLEAN DEFAULT TRUE,
              visible_to_viewer BOOLEAN DEFAULT TRUE
            )
        `);

        await pool.query(`
            INSERT INTO resources_final (id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer)
            SELECT id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer
            FROM resources
        `);

        await pool.query('DROP TABLE resources CASCADE');
        await pool.query('ALTER TABLE resources_final RENAME TO resources');

        // Fix Sequences
        await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
        await pool.query("SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources))");

        await pool.query('COMMIT');
        console.log('✅ Constraints Fixed & Restore Complete!');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('❌ Fix Failed:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
