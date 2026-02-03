import pg from 'pg';
import dotenv from 'dotenv';
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

async function createTestUser() {
    try {
        console.log('Connecting to DB to create test user...');

        // Note: src/database.ts inserts 'user_id' manually, but the prompt implies
        // the DB might generate a UUID. I will try to insert without user_id first
        // if the column allows it (defaults to uuid_generate_v4()?), otherwise
        // I'll provide a generated one or handle the error.
        // Looking at the prompt: "RETURNING uuid" implies column name 'uuid' or 'id'.
        // src/database.ts uses 'user_id' as a string.

        // I will inspect the columns first to be safe.
        const cols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Table columns:', cols.rows.map(r => r.column_name).join(', '));

        const query = `
            INSERT INTO users (email, username, password_hash, role, user_id, is_active, must_change_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;

        // I'm providing user_id as "user:admin" to match the pattern in the codebase
        // just in case it is required, but I will log the full returned row.
        const values = [
            'admin@test.com',
            'admin',
            'temporary_password_hash',
            'admin',
            'user:admin', // Providing explicit user_id based on codebase pattern
            true,
            true
        ];

        const res = await pool.query(query, values);
        console.log('✅ User created successfully!');
        console.log('Returned Row:', res.rows[0]);

        if (res.rows[0].id) console.log('👉 ID/UUID:', res.rows[0].id);
        if (res.rows[0].uuid) console.log('👉 UUID:', res.rows[0].uuid);

    } catch (err) {
        console.error('❌ Error creating user:', err.message);
        if (err.code === '23505') { // Unique violation
            console.log('⚠️  User probably already exists. Checking DB...');
            try {
                const check = await pool.query("SELECT * FROM users WHERE username = 'admin'");
                console.log('Existing User:', check.rows[0]);
            } catch (e) { console.error(e); }
        }
    } finally {
        await pool.end();
    }
}

createTestUser();
