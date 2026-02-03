
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
        console.log('🚀 RECOVERY SWAP OPERATION 🚀');
        await pool.query('BEGIN');

        // 1. CREATE RECOVERED TABLES
        console.log('✨ Creating users_recovered...');
        await pool.query('DROP TABLE IF EXISTS users_recovered');
        await pool.query(`
            CREATE TABLE users_recovered (
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

        console.log('✨ Creating resources_recovered...');
        await pool.query('DROP TABLE IF EXISTS resources_recovered');
        await pool.query(`
            CREATE TABLE resources_recovered (
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

        // 2. INSERT DATA
        const users = JSON.parse(fs.readFileSync('users_dump.json', 'utf8'));
        const resources = JSON.parse(fs.readFileSync('resources_dump.json', 'utf8'));

        console.log('📥 Inserting Users into recovered table...');
        for (const u of users) {
            const id = parseInt(u.id);
            await pool.query(`
                INSERT INTO users_recovered (id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [id, u.user_id, u.username, u.email, u.password_hash, u.role, u.must_change_password, u.is_active, u.last_login, u.created_at, u.updated_at]);
        }

        console.log('📥 Inserting Resources into recovered table...');
        for (const r of resources) {
            const id = parseInt(r.id);
            await pool.query(`
                INSERT INTO resources_recovered (id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [id, r.resource_type, r.data, r.created_by, r.created_at, r.visible_to_owner, r.visible_to_admin, r.visible_to_editor, r.visible_to_viewer]);
        }

        // 3. SWAP
        console.log('🔄 Swapping tables...');
        await pool.query('DROP TABLE IF EXISTS users CASCADE');
        await pool.query('DROP TABLE IF EXISTS resources CASCADE');

        await pool.query('ALTER TABLE users_recovered RENAME TO users');
        await pool.query('ALTER TABLE resources_recovered RENAME TO resources');

        // 4. FIX SEQUENCES (on the new tables)
        console.log('🔧 Fixing Sequences...');
        // The sequences for _recovered might be users_recovered_id_seq.
        // We need to rename sequence or just reset whatever is attached.
        // id SERIAL creates a sequence named table_id_seq.
        // When we rename table, sequence usually renames or stays bound.
        // Let's explicitly setval on the presumed sequence name.
        // Actually, renaming table renames sequence? Often does.
        // Let's check metadata if needed, but for now blind setval.

        // Wait, if we rename, the sequence name might still be users_recovered_id_seq unless we rename it too.
        // But `nextval` in DEFAULT points to OID, so it works.
        // We just need to know the name to call `setval`.

        // Let's assume usage of existing sequence attached to column.
        await pool.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users))`);
        await pool.query(`SELECT setval(pg_get_serial_sequence('resources', 'id'), (SELECT MAX(id) FROM resources))`);

        await pool.query('COMMIT');
        console.log('✅ RECOVERY SWAP COMPLETE!');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('❌ Swap Failed:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
