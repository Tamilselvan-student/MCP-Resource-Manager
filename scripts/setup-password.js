import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
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
    password: process.env.DB_PASSWORD || 'password'
});

async function setup() {
    try {
        // Check if password_hash column exists
        console.log('Checking if password_hash column exists...');
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'password_hash'
        `);

        if (checkColumn.rows.length === 0) {
            console.log('Adding password_hash column...');
            await pool.query('ALTER TABLE users ADD COLUMN password_hash TEXT');
            console.log('✅ Column added');
        } else {
            console.log('✅ Column already exists');
        }

        // Hash password
        const password = 'admin123';
        const hash = await bcrypt.hash(password, 10);
        console.log('Generated hash:', hash.substring(0, 20) + '...');

        // Update user
        const result = await pool.query(`
            UPDATE users
            SET password_hash = $1
            WHERE email = $2
            RETURNING uuid, email
        `, [hash, 'admin@test.com']);

        if (result.rows.length > 0) {
            console.log('✅ Password updated for:', result.rows[0].email);
        } else {
            console.log('❌ No user found with email admin@test.com');
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        await pool.end();
    }
}

setup();
