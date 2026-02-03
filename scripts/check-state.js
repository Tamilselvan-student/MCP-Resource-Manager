
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

async function check() {
    try {
        const query = "SELECT table_name FROM information_schema.tables WHERE table_name IN ('users', 'resources', 'users_backup', 'resources_backup')";
        const res = await pool.query(query);
        console.log('Tables found:', res.rows.map(r => r.table_name).join(', '));

        for (const t of res.rows) {
            const count = await pool.query(`SELECT count(*) FROM ${t.table_name}`);
            console.log(`${t.table_name}: ${count.rows[0].count} rows`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
