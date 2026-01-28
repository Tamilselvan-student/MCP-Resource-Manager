import pool from '../dist/database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function findResource() {
    console.log('🔍 Searching for TEST2...');
    try {
        const res = await pool.query("SELECT * FROM resources WHERE data::text LIKE '%TEST2.pdf%' OR data::text LIKE '%TEST2%'");

        if (res.rows.length === 0) {
            console.log('❌ No resource found matching "TEST2".');
            // Dump last 5 resources to see what's there
            const last5 = await pool.query("SELECT id, created_by, data FROM resources ORDER BY created_at DESC LIMIT 5");
            console.log('   Last 5 resources:', last5.rows);
        } else {
            console.log('✅ Found Resource:', res.rows[0]);
            console.log('   ID:', res.rows[0].id);
            console.log('   Created By:', res.rows[0].created_by);
            console.log('   Visible to Viewer:', res.rows[0].visible_to_viewer);
        }
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit(0);
    }
}

findResource();
