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

async function migrate() {
    try {
        console.log('Adding data column to resources table...');

        try {
            await pool.query(`
                ALTER TABLE resources 
                ADD COLUMN data JSONB
            `);
            console.log(`✅ Added column: data`);
        } catch (e) {
            console.log(`ℹ️  Column data check failed: ${e.message}`);
        }

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}
migrate();
