import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { randomUUID } from 'crypto';

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

async function createAdmin() {
    try {
        const email = 'tharsan@example.com';
        const username = 'tharsan';
        const password = 'Tharsan@123';
        const role = 'admin';

        console.log('Creating admin user:', username);

        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT uuid, email FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            console.log('❌ User already exists with email:', email);
            console.log('   UUID:', existingUser.rows[0].uuid);
            await pool.end();
            return;
        }

        // Hash password
        console.log('Hashing password...');
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate a proper UUID
        const userUuid = randomUUID();

        // Insert user with all required fields
        console.log('Inserting user into database...');
        const result = await pool.query(`
            INSERT INTO users (uuid, email, username, password_hash, role, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING uuid, email, username, role, created_at
        `, [userUuid, email, username, passwordHash, role]);

        const newUser = result.rows[0];

        console.log('✅ Admin user created successfully!');
        console.log('   UUID:', newUser.uuid);
        console.log('   Email:', newUser.email);
        console.log('   Username:', newUser.username);
        console.log('   Role:', newUser.role);
        console.log('   Created:', newUser.created_at);
        console.log('\nLogin credentials:');
        console.log('   Email:', email);
        console.log('   Password:', password);

        await pool.end();
    } catch (err) {
        console.error('Error creating admin user:', err.message);
        console.error('Details:', err);
        await pool.end();
    }
}

createAdmin();
