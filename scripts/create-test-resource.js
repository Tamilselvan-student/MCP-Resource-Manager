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
        const ADMIN_UUID = '7494cbc5-3af0-48de-8185-f4e8a3b920c3';

        const res = await pool.query(`
            INSERT INTO resources (category, data, created_by)
            VALUES ($1, $2, $3)
            RETURNING uuid;
        `, ['project', '{"name": "Test Resource", "note": "Created during STEP 3"}', ADMIN_UUID]);

        fs.writeFileSync('resource_result.txt', JSON.stringify({ status: 'created', uuid: res.rows[0].uuid }, null, 2));

    } catch (err) {
        fs.writeFileSync('resource_result.txt', `ERROR: ${err.message}\n${JSON.stringify(err, null, 2)}`);
    } finally {
        await pool.end();
    }
}

main();
