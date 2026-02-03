
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import 'dotenv/config';
import fs from 'fs';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function run() {
    try {
        console.log('🚀 STEP BY STEP RESTORE 🚀');
        await pool.query('BEGIN');

        await pool.query('DROP TABLE IF EXISTS users CASCADE');
        await pool.query('DROP TABLE IF EXISTS resources CASCADE');

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

        const users = JSON.parse(fs.readFileSync('users_dump.json', 'utf8'));
        const resources = JSON.parse(fs.readFileSync('resources_dump.json', 'utf8'));

        // USERS
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            try {
                const id = parseInt(u.id);
                console.log(`Trying User ${i} (${u.username})...`);
                await pool.query(`
                    INSERT INTO users (id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [id, u.user_id, u.username, u.email, u.password_hash, u.role, u.must_change_password, u.is_active, u.last_login, u.created_at, u.updated_at]);
                console.log(`✅ User ${i} Success`);
            } catch (e) {
                console.error(`❌ User ${i} Failed:`, e.message);
                // Continue!
            }
        }

        // RESOURCES
        for (let i = 0; i < resources.length; i++) {
            const r = resources[i];
            try {
                const id = parseInt(r.id);
                await pool.query(`
                    INSERT INTO resources (id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [id, r.resource_type, r.data, r.created_by, r.created_at, r.visible_to_owner, r.visible_to_admin, r.visible_to_editor, r.visible_to_viewer]);
            } catch (e) {
                console.error(`❌ Resource ${i} Failed:`, e.message);
            }
        }

        console.log('🔧 Fixing Sequences...');
        await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
        await pool.query("SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources))");

        await pool.query('COMMIT');
        console.log('✅ COMPLETE (With potential skips)');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('❌ FATAL:', e);
    } finally {
        await pool.end();
    }
}
run();
