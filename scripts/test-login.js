import pg from 'pg';
import bcrypt from 'bcrypt';
import bcryptjs from 'bcryptjs';
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

async function testLogin() {
    try {
        console.log('🔍 Testing login for: tharsank@example.com\n');

        const email = 'tharsank@example.com';
        const password = 'Tharsan@123';

        // 1. Check if user exists
        const userResult = await pool.query(`
            SELECT 
                id,
                user_id,
                username,
                email,
                password_hash,
                role,
                is_active,
                must_change_password
            FROM users
            WHERE email = $1
        `, [email]);

        if (userResult.rows.length === 0) {
            console.log('❌ User not found with email:', email);
            console.log('\n📋 All users in database:');
            const allUsers = await pool.query('SELECT email, username, role FROM users');
            console.table(allUsers.rows);
            return;
        }

        const user = userResult.rows[0];
        console.log('✅ User found:');
        console.log('  - ID:', user.id);
        console.log('  - User ID:', user.user_id);
        console.log('  - Username:', user.username);
        console.log('  - Email:', user.email);
        console.log('  - Role:', user.role);
        console.log('  - Active:', user.is_active);
        console.log('  - Must change password:', user.must_change_password);
        console.log('  - Password hash length:', user.password_hash?.length || 0);
        console.log('  - Password hash preview:', user.password_hash?.substring(0, 20) + '...');

        // 2. Test password with bcrypt
        console.log('\n🔐 Testing password with bcrypt...');
        try {
            const bcryptMatch = await bcrypt.compare(password, user.password_hash);
            console.log('  bcrypt result:', bcryptMatch ? '✅ MATCH' : '❌ NO MATCH');
        } catch (err) {
            console.log('  bcrypt error:', err.message);
        }

        // 3. Test password with bcryptjs
        console.log('\n🔐 Testing password with bcryptjs...');
        try {
            const bcryptjsMatch = await bcryptjs.compare(password, user.password_hash);
            console.log('  bcryptjs result:', bcryptjsMatch ? '✅ MATCH' : '❌ NO MATCH');
        } catch (err) {
            console.log('  bcryptjs error:', err.message);
        }

        // 4. Generate new hash with bcrypt and test
        console.log('\n🔧 Generating fresh hash with bcrypt...');
        const freshBcryptHash = await bcrypt.hash(password, 10);
        console.log('  Fresh hash:', freshBcryptHash.substring(0, 20) + '...');
        const freshBcryptMatch = await bcrypt.compare(password, freshBcryptHash);
        console.log('  Fresh hash test:', freshBcryptMatch ? '✅ MATCH' : '❌ NO MATCH');

        // 5. Generate new hash with bcryptjs and test
        console.log('\n🔧 Generating fresh hash with bcryptjs...');
        const freshBcryptjsHash = await bcryptjs.hash(password, 10);
        console.log('  Fresh hash:', freshBcryptjsHash.substring(0, 20) + '...');
        const freshBcryptjsMatch = await bcryptjs.compare(password, freshBcryptjsHash);
        console.log('  Fresh hash test:', freshBcryptjsMatch ? '✅ MATCH' : '❌ NO MATCH');

        // 6. Recommendation
        console.log('\n💡 RECOMMENDATION:');
        if (!bcryptMatch && !bcryptjsMatch) {
            console.log('  The stored password hash does NOT match the password "Tharsan@123"');
            console.log('  You need to update the password hash in the database.');
            console.log('\n  Run this to fix:');
            console.log('  UPDATE users SET password_hash = $1 WHERE email = $2');
            console.log('  With hash:', freshBcryptHash);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

testLogin();
