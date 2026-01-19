import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Test database connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

// ============================================
// INITIALIZE DATABASE
// ============================================

export async function initDatabase() {
    try {
        // NOTE: Table creation is handled by migration scripts
        // The users table now includes authentication columns (email, password_hash, etc.)
        // See: database/migrations/01_add_authentication_columns.sql

        // Check if users table exists
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        `);

        if (result.rows[0].exists) {
            console.log('✅ Users table ready');
        } else {
            console.log('⚠️  Users table not found. Run migration scripts first.');
            console.log('   See: database/migrations/README.md');
        }
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// ============================================
// SEED INITIAL USERS
// ============================================

export async function seedUsers() {
    try {
        // NOTE: User seeding is now handled by migration scripts
        // Migration populates users with email and password_hash
        // See: database/migrations/01_add_authentication_columns.sql

        // Check if users exist
        const result = await pool.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(result.rows[0].count);

        if (userCount > 0) {
            console.log(`✅ Found ${userCount} users in database`);
        } else {
            console.log('⚠️  No users found. Run migration scripts to seed default users.');
            console.log('   See: database/migrations/README.md');
        }
    } catch (error) {
        console.error('❌ Error checking users:', error);
        throw error;
    }
}

// ============================================
// GET ALL USERS
// ============================================

export async function getUsers() {
    try {
        const result = await pool.query(`
            SELECT user_id, username, role, created_at
            FROM users
            ORDER BY created_at ASC;
        `);
        return result.rows;
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        throw error;
    }
}

// ============================================
// GET USER ROLE
// ============================================

export async function getUserRole(userId: string): Promise<string | null> {
    try {
        const result = await pool.query(`
            SELECT role
            FROM users
            WHERE user_id = $1;
        `, [userId]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0].role;
    } catch (error) {
        console.error('❌ Error fetching user role:', error);
        throw error;
    }
}

// ============================================
// ADD USER
// ============================================

export async function addUser(userId: string, username: string, email: string, name: string, role: string) {
    try {
        // Hash default password
        const defaultPassword = 'changeme123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const result = await pool.query(`
            INSERT INTO users (user_id, username, email, password_hash, role, must_change_password, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `, [userId, username, email, hashedPassword, role, true, true]);  // Changed to true

        console.log(`✅ Created user in database: ${username} (${email}) with role ${role} - must change password`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Error adding user:', error);
        throw error;
    }
}

// ============================================
// DELETE USER
// ============================================

export async function deleteUser(userId: string) {
    try {
        // Prevent deletion of default users
        const protectedUsers = ['user:tharsan', 'user:admin'];
        if (protectedUsers.includes(userId)) {
            throw new Error('Cannot delete protected users (tharsan, admin)');
        }

        const result = await pool.query(`
            DELETE FROM users
            WHERE user_id = $1
            RETURNING *;
        `, [userId]);

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        return result.rows[0];
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        throw error;
    }
}

// ============================================
// GET USER BY EMAIL (for authentication)
// ============================================

export async function getUserByEmail(email: string) {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                user_id,
                username,
                email,
                password_hash,
                role,
                must_change_password,
                last_login,
                is_active,
                created_at,
                updated_at
            FROM users
            WHERE email = $1 AND is_active = true
        `, [email]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        console.error('❌ Error fetching user by email:', error);
        throw error;
    }
}

// ============================================
// CLOSE DATABASE CONNECTION
// ============================================

export async function closeDatabase() {
    await pool.end();
    console.log('🛑 Database connection closed');
}

export default pool;
