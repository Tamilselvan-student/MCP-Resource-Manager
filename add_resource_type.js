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
        console.log('Adding resource_type column to resources table...');

        try {
            await pool.query(`
                ALTER TABLE resources 
                ADD COLUMN resource_type VARCHAR(50)
            `);
            console.log(`✅ Added column: resource_type`);
        } catch (e) {
            if (e.code === '42701') { // duplicate_column
                console.log(`ℹ️  Column resource_type already exists`);
            } else {
                console.error(`❌ Error adding resource_type:`, e.message);
            }
        }

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}
migrate();
