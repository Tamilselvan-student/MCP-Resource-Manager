
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
        console.log('🔄 Starting Full Database Restore...');
        await pool.query('BEGIN');

        // 1. Create Users Table
        // Assuming schema based on known pre-migration state
        console.log('🔹 Creating users table...');
        await pool.query(`
        CREATE TABLE users (
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
        );
      `);

        // Populate Users
        console.log('🔹 Populating users...');
        await pool.query(`
        INSERT INTO users (id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at)
        SELECT id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at
        FROM users_backup;
      `);

        // 2. Create Resources Table
        console.log('🔹 Creating resources table...');
        await pool.query(`
        CREATE TABLE resources (
          id SERIAL PRIMARY KEY,
          resource_type TEXT NOT NULL,
          data JSONB NOT NULL,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          visible_to_owner BOOLEAN DEFAULT TRUE,
          visible_to_admin BOOLEAN DEFAULT TRUE,
          visible_to_editor BOOLEAN DEFAULT TRUE,
          visible_to_viewer BOOLEAN DEFAULT TRUE
        );
      `);

        // Populate Resources
        console.log('🔹 Populating resources...');
        await pool.query(`
        INSERT INTO resources (id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer)
        SELECT id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer
        FROM resources_backup;
      `);

        // 3. Reset Sequences
        console.log('🔹 Resetting sequences...');
        await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
        await pool.query("SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources))");

        await pool.query('COMMIT');

        console.log('✅ Full Restore Complete! System returned to pre-UUID state.');

        // Verify count
        const uCount = await pool.query('SELECT COUNT(*) FROM users');
        const rCount = await pool.query('SELECT COUNT(*) FROM resources');
        console.log(`📊 Users: ${uCount.rows[0].count}, Resources: ${rCount.rows[0].count}`);

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('❌ Restore Failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
