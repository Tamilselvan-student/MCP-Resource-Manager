import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mcp_resources',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});

async function main() {
    try {
        console.log('--- STARTING USER CREATION ---');

        // 1. Check if user already exists
        const check = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        if (check.rows.length > 0) {
            fs.writeFileSync('user_result.txt', JSON.stringify({ status: 'exists', user: check.rows[0] }, null, 2));
            return;
        }

        // 2. Insert User
        // Note: I am providing user_id='user:admin' because the schema seems to require it or uses it as the main ID.
        // However, the prompt asked to return uuid from DB. I will check what columns exist in result.
        // 2. Insert User matching PROMPT SQL exactly
        const res = await pool.query(`
            INSERT INTO users (email, username, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING uuid;
        `, ['admin@test.com', 'admin', 'temporary_password_hash', 'admin']);

        fs.writeFileSync('user_result.txt', JSON.stringify({ status: 'created', uuid: res.rows[0].uuid }, null, 2));

    } catch (err) {
        fs.writeFileSync('user_result.txt', `ERROR: ${err.message}\n${JSON.stringify(err, null, 2)}`);
    } finally {
        await pool.end();
    }
}

main();
