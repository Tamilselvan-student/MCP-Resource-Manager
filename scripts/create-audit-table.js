import pg from 'pg';
import dotenv from 'dotenv';
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
    password: process.env.DB_PASSWORD || 'password'
});

async function createAuditLogsTable() {
    try {
        console.log('Creating audit_logs table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_uuid TEXT NOT NULL,
                action TEXT NOT NULL CHECK (action IN ('read', 'write')),
                resource_uuid TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ audit_logs table created');

        // Create index for faster queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_uuid ON audit_logs(user_uuid);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
        `);

        console.log('✅ Indexes created');

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        await pool.end();
    }
}

createAuditLogsTable();
