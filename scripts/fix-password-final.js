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

async function fixPassword() {
    try {
        const email = 'tharsan@example.com';
        const password = 'Tharsan@123';

        console.log(`🔧 Fixing password for: ${email}\n`);

        // Hash the password
        console.log('Hashing password...');
        const passwordHash = await bcrypt.hash(password, 10);
        console.log('✅ Password hashed\n');

        // Update the password
        console.log('Updating database...');
        const result = await pool.query(`
            UPDATE users 
            SET password_hash = $1,
                must_change_password = false,
                is_active = true,
                updated_at = NOW()
            WHERE email = $2
            RETURNING uuid, email, username, role, is_active
        `, [passwordHash, email]);

        if (result.rows.length === 0) {
            console.log('❌ User not found with email:', email);
            console.log('\nAll users:');
            const all = await pool.query('SELECT email, username FROM users');
            console.table(all.rows);
        } else {
            console.log('✅ SUCCESS! Password updated\n');
            console.log('User details:');
            console.table(result.rows);
            console.log(`\n🎉 You can now login with:`);
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

fixPassword();
