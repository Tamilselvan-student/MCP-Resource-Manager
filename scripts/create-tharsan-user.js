import pg from 'pg';
import bcrypt from 'bcrypt';
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

async function createOrUpdateUser() {
    const logFile = path.join(__dirname, 'user-creation-log.txt');
    let log = '';

    try {
        const email = 'tharsank@example.com';
        const username = 'tharsan';
        const password = 'Tharsan@123';
        const role = 'admin';

        log += `🔧 Creating/Updating user: ${email}\n\n`;

        // Hash the password
        log += 'Hashing password...\n';
        const passwordHash = await bcrypt.hash(password, 10);
        log += `Hash generated successfully\n\n`;

        // Check if user exists
        const existing = await pool.query('SELECT uuid, email FROM users WHERE email = $1', [email]);

        if (existing.rows.length > 0) {
            log += `User already exists, updating password...\n`;
            const result = await pool.query(`
                UPDATE users 
                SET password_hash = $1,
                    must_change_password = false,
                    is_active = true,
                    updated_at = NOW()
                WHERE email = $2
                RETURNING uuid, email, username, role
            `, [passwordHash, email]);

            log += '✅ Password updated!\n\n';
            log += JSON.stringify(result.rows[0], null, 2) + '\n';
        } else {
            log += `Creating new user...\n`;
            const result = await pool.query(`
                INSERT INTO users (email, username, password_hash, role, is_active, must_change_password, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                RETURNING uuid, email, username, role
            `, [email, username, passwordHash, role, true, false]);

            log += '✅ User created!\n\n';
            log += JSON.stringify(result.rows[0], null, 2) + '\n';
        }

        log += '\n🎉 SUCCESS! You can now login with:\n';
        log += `   Email: ${email}\n`;
        log += `   Password: ${password}\n`;

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

createOrUpdateUser();
