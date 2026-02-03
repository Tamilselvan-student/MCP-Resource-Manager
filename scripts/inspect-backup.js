
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

async function inspect() {
    try {
        console.log('🔍 Inspecting users_backup columns...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users_backup'
            ORDER BY ordinal_position
        `);
        console.table(res.rows);

        console.log('🔍 Inspecting resources_backup columns...');
        const res2 = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'resources_backup'
            ORDER BY ordinal_position
        `);
        console.table(res2.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
inspect();
