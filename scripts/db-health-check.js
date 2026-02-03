
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
        console.log('🏥 DB Health Check...');

        // 1. Check Tables Existence in Catalog
        console.log('Checking information_schema...');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'resources')
        `);
        console.log('Found tables:', tables.rows.map(t => t.table_name).join(', '));

        if (tables.rows.length < 2) {
            console.error('❌ Missing tables in catalog!');
        }

        // 2. Check Data Readability (Full Scan)
        console.log('Reading USERS...');
        const users = await pool.query('SELECT * FROM users');
        console.log(`✅ Read ${users.rows.length} users.`);

        console.log('Reading RESOURCES...');
        const resources = await pool.query('SELECT * FROM resources');
        console.log(`✅ Read ${resources.rows.length} resources.`);

        // 3. Check Constraints/Indexes
        console.log('Checking Constraints...');
        const constraints = await pool.query(`
            SELECT conname, contype 
            FROM pg_constraint 
            WHERE conrelid = 'resources'::regclass
        `);
        console.log('Resources Constraints:', constraints.rows.map(c => `${c.conname} (${c.contype})`).join(', '));

    } catch (e) {
        console.error('❌ Health Check Failed:', e);
    } finally {
        await pool.end();
    }
}
run();
