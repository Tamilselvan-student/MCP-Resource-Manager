
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
        console.log('🧪 Debug Manual Insert FULL...');

        await pool.query('DROP TABLE IF EXISTS users_debug');
        await pool.query(`
            CREATE TABLE users_debug (
              id SERIAL PRIMARY KEY,
              user_id TEXT,
              username TEXT,
              email TEXT,
              password_hash TEXT,
              role TEXT,
              must_change_password BOOLEAN,
              is_active BOOLEAN,
              last_login TIMESTAMP,
              created_at TIMESTAMP,
              updated_at TIMESTAMP
            );
        `);

        const users = JSON.parse(fs.readFileSync('users_dump.json', 'utf8'));
        const u = users[0];
        console.log('User:', u);

        // ALL COLUMNS
        console.log('Inserting ALL params...');
        await pool.query(`
            INSERT INTO users_debug (id, user_id, username, email, password_hash, role, must_change_password, is_active, last_login, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            parseInt(u.id),
            u.user_id,
            u.username,
            u.email,
            u.password_hash,
            u.role,
            u.must_change_password,
            u.is_active,
            u.last_login,
            u.created_at,
            u.updated_at
        ]);
        console.log('✅ FULL JSON success');

    } catch (e) {
        console.error('❌ FAIL:', e);
    } finally {
        await pool.end();
    }
}
run();
