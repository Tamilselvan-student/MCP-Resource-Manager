
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

async function list() {
    try {
        const u = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users_backup'");
        console.log('USERS_BACKUP COLS:', u.rows.map(r => r.column_name).join(', '));

        const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'resources_backup'");
        console.log('RESOURCES_BACKUP COLS:', r.rows.map(r => r.column_name).join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
list();
