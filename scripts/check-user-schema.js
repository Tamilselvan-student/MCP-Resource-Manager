import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mcp_resources',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

async function checkSchema() {
    try {
        // Get one existing user to see the structure
        const result = await pool.query('SELECT * FROM users LIMIT 1');

        if (result.rows.length > 0) {
            console.log('Existing user structure:');
            console.log(JSON.stringify(result.rows[0], null, 2));
            console.log('\nColumn names:', Object.keys(result.rows[0]));
        } else {
            console.log('No users found in database');
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        await pool.end();
    }
}

checkSchema();
