import pg from 'pg';
import bcrypt from 'bcrypt';
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
    password: process.env.DB_PASSWORD || 'password',
});

async function fixUserPassword() {
    try {
        console.log('🔧 Fixing user password...');

        const email = 'tharsank@example.com';
        const password = 'Tharsan@123';

        // Hash the password properly
        const passwordHash = await bcrypt.hash(password, 10);
        console.log('✅ Password hashed successfully');

        // Update the user's password
        const result = await pool.query(`
            UPDATE users 
            SET password_hash = $1,
                must_change_password = false,
                is_active = true
            WHERE email = $2
            RETURNING user_id, username, email, role, is_active
        `, [passwordHash, email]);

        if (result.rows.length === 0) {
            console.log('❌ User not found with email:', email);
        } else {
            console.log('✅ Password updated successfully for user:');
            console.log(JSON.stringify(result.rows[0], null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

fixUserPassword();
