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

async function updatePassword() {
    const logFile = path.join(__dirname, 'password-update-log.txt');
    let log = '';

    try {
        log += '🔧 Updating password for tharsank@example.com\n\n';

        const email = 'tharsank@example.com';
        const newPassword = 'Tharsan@123';

        // Hash the password
        log += 'Hashing password...\n';
        const passwordHash = await bcrypt.hash(newPassword, 10);
        log += `Hash generated: ${passwordHash.substring(0, 30)}...\n\n`;

        // Update the password
        log += 'Updating database...\n';
        const result = await pool.query(`
            UPDATE users 
            SET password_hash = $1,
                must_change_password = false,
                is_active = true
            WHERE email = $2
            RETURNING user_id, username, email, role
        `, [passwordHash, email]);

        if (result.rows.length === 0) {
            log += '❌ User not found!\n';
            log += 'Checking all users...\n\n';

            const allUsers = await pool.query('SELECT user_id, username, email, role FROM users');
            log += `Found ${allUsers.rows.length} users:\n`;
            allUsers.rows.forEach(u => {
                log += `  - ${u.email} (${u.username}, ${u.role})\n`;
            });
        } else {
            log += '✅ Password updated successfully!\n\n';
            log += 'User details:\n';
            log += JSON.stringify(result.rows[0], null, 2) + '\n\n';
            log += '🎉 You can now login with:\n';
            log += `   Email: ${email}\n`;
            log += `   Password: ${newPassword}\n`;
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

updatePassword();
