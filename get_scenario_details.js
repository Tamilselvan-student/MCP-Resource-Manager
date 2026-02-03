import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function run() {
    try {
        console.log('Scenario Details:');

        const user = await pool.query("SELECT uuid, email, role FROM users WHERE username = 'viewer_test'");
        const resources = await pool.query("SELECT uuid, resource_type, data, created_at FROM resources WHERE created_by = $1", [user.rows[0]?.uuid]);

        console.log('User:', user.rows[0]);
        console.log('Resources:', resources.rows.map(r => ({ id: r.uuid, name: r.data.name, type: r.resource_type })));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}
run();
