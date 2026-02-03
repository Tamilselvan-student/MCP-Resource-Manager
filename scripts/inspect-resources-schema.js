import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mcp_resources',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});

async function main() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'resources'
            ORDER BY ordinal_position;
        `);

        const cols = res.rows.map(r => `${r.column_name} (${r.data_type})`);
        fs.writeFileSync('schema_resources.txt', JSON.stringify(cols, null, 2));
    } catch (err) {
        fs.writeFileSync('schema_resources.txt', `ERROR: ${err.message}`);
    } finally {
        await pool.end();
    }
}

main();
