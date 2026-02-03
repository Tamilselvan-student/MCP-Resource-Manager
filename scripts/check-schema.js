import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

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

async function checkSchema() {
    const logFile = path.join(__dirname, 'schema-check-log.txt');
    let log = '';

    try {
        log += '📋 Checking users table schema...\n\n';

        // Get column information
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);

        log += 'Columns in users table:\n';
        columns.rows.forEach(col => {
            log += `  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})\n`;
        });

        log += '\n📊 Sample user data:\n';
        const users = await pool.query('SELECT * FROM users LIMIT 1');
        if (users.rows.length > 0) {
            log += JSON.stringify(users.rows[0], null, 2) + '\n';
        } else {
            log += 'No users found in database\n';
        }

    } catch (error) {
        log += `❌ Error: ${error.message}\n`;
        log += JSON.stringify(error, null, 2) + '\n';
    } finally {
        await pool.end();
        fs.writeFileSync(logFile, log);
        console.log(log);
        console.log(`\n📄 Full log saved to: ${logFile}`);
    }
}

checkSchema();
