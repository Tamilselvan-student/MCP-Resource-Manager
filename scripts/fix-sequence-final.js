
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import 'dotenv/config';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function run() {
    try {
        console.log('🔧 Fixing Sequences Final...');

        // RESOURCES
        console.log('🔹 Resources...');
        await pool.query('CREATE SEQUENCE IF NOT EXISTS resources_id_seq');
        await pool.query("ALTER TABLE resources ALTER COLUMN id SET DEFAULT nextval('resources_id_seq')");
        const maxR = await pool.query('SELECT MAX(id) FROM resources');
        const nextR = (parseInt(maxR.rows[0].max) || 0) + 1;
        await pool.query(`SELECT setval('resources_id_seq', ${nextR}, false)`);
        console.log(`✅ Resources sequence set to ${nextR}`);

        // USERS
        console.log('🔹 Users...');
        await pool.query('CREATE SEQUENCE IF NOT EXISTS users_id_seq');
        await pool.query("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')");
        const maxU = await pool.query('SELECT MAX(id) FROM users');
        const nextU = (parseInt(maxU.rows[0].max) || 0) + 1;
        await pool.query(`SELECT setval('users_id_seq', ${nextU}, false)`);
        console.log(`✅ Users sequence set to ${nextU}`);

    } catch (e) {
        console.error('❌ Fix Failed:', e);
    } finally {
        await pool.end();
    }
}
run();
