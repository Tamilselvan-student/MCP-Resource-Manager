import { Router, Response } from 'express';
import { AuthRequest, LoginRequest, ChangePasswordRequest } from './types.js';
import { hashPassword, comparePassword } from './password.js';
import { generateToken } from './jwt.js';
import pool from '../database.js';
import { authenticateToken } from './middleware.js';

const router = Router();

// ============================================
// POST /api/auth/signup
// ============================================

router.post('/signup', async (req: AuthRequest, res: Response) => {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Username, email, and password are required'
        });
    }

    // Validate password strength
    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters long'
        });
    }

    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({
            success: false,
            error: 'Password must contain at least one uppercase letter'
        });
    }

    if (!/[a-z]/.test(password)) {
        return res.status(400).json({
            success: false,
            error: 'Password must contain at least one lowercase letter'
        });
    }

    if (!/[0-9]/.test(password)) {
        return res.status(400).json({
            success: false,
            error: 'Password must contain at least one number'
        });
    }

    try {
        // Check if email already exists
        const existingUser = await pool.query(
            'SELECT email FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Generate user_id
        const userId = `user:${username.toLowerCase()}`;

        // Check if user_id already exists
        const existingUserId = await pool.query(
            'SELECT user_id FROM users WHERE user_id = $1',
            [userId]
        );

        if (existingUserId.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Username already taken'
            });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create new user (default role: viewer)
        const result = await pool.query(`
            INSERT INTO users (user_id, username, email, password_hash, role, must_change_password, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, user_id, username, email, role, must_change_password, is_active
        `, [userId, username, email, passwordHash, 'viewer', false, true]);

        const newUser = result.rows[0];

        // Generate JWT token
        const token = generateToken({
            userId: newUser.user_id,
            email: newUser.email,
            role: newUser.role
        });

        // Set HTTP-only cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        console.log(`✅ New user registered and logged in: ${newUser.email} (${newUser.role})`);

        // Return user info (automatically logged in)
        return res.json({
            success: true,
            user: {
                id: newUser.id,
                user_id: newUser.user_id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                must_change_password: newUser.must_change_password
            }
        });

    } catch (error: any) {
        console.error('Signup error:', error);
        return res.status(500).json({
            success: false,
            error: 'Signup failed',
            message: 'An error occurred during registration'
        });
    }
});

// ============================================
// POST /api/auth/login
// ============================================

router.post('/login', async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body as LoginRequest;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email and password are required'
        });
    }

    try {
        // Look up user by email
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
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        const user = result.rows[0];

        // Verify password
        const isPasswordValid = await comparePassword(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        // Generate JWT token
        const token = generateToken({
            userId: user.user_id,
            email: user.email,
            role: user.role
        });

        // Set HTTP-only cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Update last_login timestamp
        await pool.query(`
            UPDATE users 
            SET last_login = NOW() 
            WHERE user_id = $1
        `, [user.user_id]);

        console.log(`✅ User logged in: ${user.email} (${user.role})`);

        // Return user info (without password_hash)
        return res.json({
            success: true,
            user: {
                id: user.id,
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                must_change_password: user.must_change_password
            }
        });

    } catch (error: any) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            error: 'Login failed',
            message: 'An error occurred during login'
        });
    }
});

// ============================================
// GET /api/auth/me
// ============================================

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }

    // Return current user (without password_hash)
    return res.json({
        success: true,
        user: {
            id: req.user.id,
            user_id: req.user.user_id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role,
            must_change_password: req.user.must_change_password,
            last_login: req.user.last_login,
            is_active: req.user.is_active
        }
    });
});

// ============================================
// POST /api/auth/logout
// ============================================

router.post('/logout', (req: AuthRequest, res: Response) => {
    // Clear auth cookie
    res.clearCookie('auth_token', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
    });

    console.log('✅ User logged out');

    return res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// ============================================
// POST /api/auth/change-password
// ============================================

router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordRequest;

    // Validate input
    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            error: 'Current password and new password are required'
        });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
        return res.status(400).json({
            success: false,
            error: 'New password must be at least 8 characters long'
        });
    }

    try {
        // Verify current password
        const isCurrentPasswordValid = await comparePassword(
            currentPassword,
            req.user.password_hash
        );

        if (!isCurrentPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password in database
        await pool.query(`
            UPDATE users 
            SET password_hash = $1, 
                must_change_password = FALSE,
                updated_at = NOW()
            WHERE user_id = $2
        `, [newPasswordHash, req.user.user_id]);

        console.log(`✅ Password changed for user: ${req.user.email}`);

        return res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error: any) {
        console.error('Change password error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to change password',
            message: 'An error occurred while changing password'
        });
    }
});

export default router;
