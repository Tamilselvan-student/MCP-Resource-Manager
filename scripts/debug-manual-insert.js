
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
        console.log('🧪 Debug Manual Insert...');

        await pool.query('DROP TABLE IF EXISTS users_debug');
        await pool.query(`
            CREATE TABLE users_debug (
              id SERIAL PRIMARY KEY,
              user_id TEXT,
              must_change_password BOOLEAN,
              created_at TIMESTAMP
            );
        `);

        console.log('1. Inserting Hardcoded...');
        await pool.query('INSERT INTO users_debug (id, user_id, must_change_password, created_at) VALUES ($1, $2, $3, $4)',
            [1, 'test', true, new Date()]);
        console.log('✅ Hardcoded success');

        console.log('2. Inserting from JSON...');
        const users = JSON.parse(fs.readFileSync('users_dump.json', 'utf8'));
        const u = users[0];
        console.log('User:', u);

        // Try strict subset
        await pool.query('INSERT INTO users_debug (id, user_id, must_change_password, created_at) VALUES ($1, $2, $3, $4)',
            [parseInt(u.id), u.user_id, u.must_change_password, u.created_at]);
        console.log('✅ JSON subset success');

        // If this works, the issue is one of the columns I omitted.

    } catch (e) {
        console.error('❌ FAIL:', e);
    } finally {
        await pool.end();
    }
}
run();
