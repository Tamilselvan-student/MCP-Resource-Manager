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
        console.log('Adding visibility columns to resources table...');

        const columns = [
            'visible_to_owner',
            'visible_to_admin',
            'visible_to_editor',
            'visible_to_viewer'
        ];

        for (const col of columns) {
            try {
                await pool.query(`
                    ALTER TABLE resources 
                    ADD COLUMN ${col} BOOLEAN DEFAULT FALSE
                `);
                console.log(`✅ Added column: ${col}`);
            } catch (e) {
                if (e.code === '42701') { // duplicate_column
                    console.log(`ℹ️  Column ${col} already exists`);
                } else {
                    console.error(`❌ Error adding ${col}:`, e.message);
                }
            }
        }

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}
migrate();
