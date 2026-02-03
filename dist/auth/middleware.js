import { verifyToken } from './jwt.js';
import pool from '../database.js';
// ============================================
// PUBLIC ENDPOINTS (skip authentication)
// ============================================
const PUBLIC_ENDPOINTS = [
    '/api/chat',
    '/api/admin/users',
    '/health',
    '/api/auth/login',
    '/api/auth/logout'
];
/**
 * Check if a path is public (doesn't require authentication)
 */
function isPublicEndpoint(path) {
    return PUBLIC_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
}
// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
/**
 * Middleware to authenticate requests using JWT from cookies
 * Attaches user object to req.user if authenticated
 */
export async function authenticateToken(req, res, next) {
    // Skip authentication for public endpoints
    if (isPublicEndpoint(req.path)) {
        return next();
    }
    try {
        // Get token from cookie
        const token = req.cookies?.auth_token;
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'No authentication token provided'
            });
            return;
        }
        // Verify token
        const payload = verifyToken(token);
        // Look up user in database
        const result = await pool.query(`
            SELECT 
                uuid,
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
            WHERE uuid = $1 AND is_active = true
        `, [payload.userId]);
        if (result.rows.length === 0) {
            res.status(403).json({
                success: false,
                error: 'User not found or inactive',
                message: 'Invalid authentication credentials'
            });
            return;
        }
        const user = result.rows[0];
        // Attach user to request
        req.user = user;
        // Check if password change required (EXCEPT on change-password endpoints)
        // Note: req.path is relative to the router mount point
        // So /api/auth/change-password becomes /change-password
        console.log(`🔍 Auth check: path=${req.path}, must_change_password=${user.must_change_password}`);
        if (user.must_change_password &&
            !req.path.includes('/change-password') && // Matches both the route and the HTML page
            !req.path.includes('/me')) { // Allow /me to check status
            console.log(`🚫 Blocking request to ${req.path} - password change required`);
            res.status(403).json({
                success: false,
                error: 'Password change required',
                mustChangePassword: true,
                redirect: '/change-password.html'
            });
            return;
        }
        console.log(`✅ Allowing request to ${req.path}`);
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(403).json({
            success: false,
            error: 'Invalid token',
            message: error.message || 'Authentication failed'
        });
    }
}
// ============================================
// ROLE-BASED AUTHORIZATION MIDDLEWARE
// ============================================
/**
 * Middleware factory to require specific roles
 * @param allowedRoles - Array of roles that are allowed to access the endpoint
 * @returns Middleware function
 */
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to access this resource'
            });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `This resource requires one of the following roles: ${allowedRoles.join(', ')}`
            });
            return;
        }
        next();
    };
}
