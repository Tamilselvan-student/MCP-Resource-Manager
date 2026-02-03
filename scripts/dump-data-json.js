
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
        console.log('💾 Dumping Data to JSON...');

        const users = await pool.query('SELECT * FROM users');
        fs.writeFileSync('users_dump.json', JSON.stringify(users.rows, null, 2));
        console.log(`✅ Users dumped (${users.rows.length} rows)`);

        const resources = await pool.query('SELECT * FROM resources');
        fs.writeFileSync('resources_dump.json', JSON.stringify(resources.rows, null, 2));
        console.log(`✅ Resources dumped (${resources.rows.length} rows)`);

    } catch (e) {
        console.error('❌ Dump Failed:', e);
    } finally {
        await pool.end();
    }
}
run();
