
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
        console.log('🚀 RESTORE CASTED 🚀');
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

        console.log('📥 Inserting Users...');
        for (const u of users) {
            const id = parseInt(u.id);
            await pool.query(`
                INSERT INTO users (id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at)
                VALUES ($1::integer, $2::text, $3::text, $4::text, $5::text, $6::text, $7::boolean, $8::boolean, $9::timestamp, $10::timestamp, $11::timestamp)
            `, [id, u.user_id, u.username, u.email, u.password_hash, u.role, u.must_change_password, u.is_active, u.last_login, u.created_at, u.updated_at]);
        }

        console.log('📥 Inserting Resources...');
        for (const r of resources) {
            const id = parseInt(r.id);
            await pool.query(`
                INSERT INTO resources (id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer)
                VALUES ($1::integer, $2::text, $3::jsonb, $4::text, $5::timestamp, $6::boolean, $7::boolean, $8::boolean, $9::boolean)
            `, [id, r.resource_type, r.data, r.created_by, r.created_at, r.visible_to_owner, r.visible_to_admin, r.visible_to_editor, r.visible_to_viewer]);
        }

        console.log('🔧 Fixing Sequences...');
        await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
        await pool.query("SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources))");

        await pool.query('COMMIT');
        console.log('✅ COMPLETE CASTED');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('❌ FAIL:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
