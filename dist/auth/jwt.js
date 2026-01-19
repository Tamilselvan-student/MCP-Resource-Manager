import jwt from 'jsonwebtoken';
// ============================================
// JWT CONFIGURATION
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRATION = '24h';
/**
 * Generate a JWT token for a user
 * @param payload - User information to encode in token
 * @returns Signed JWT string
 */
export function generateToken(payload) {
    try {
        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRATION
        });
        return token;
    }
    catch (error) {
        console.error('Error generating JWT:', error);
        throw new Error('Failed to generate token');
    }
}
/**
 * Verify and decode a JWT token
 * @param token - JWT string to verify
 * @returns Decoded JWT payload
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        }
        else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        else {
            throw new Error('Token verification failed');
        }
    }
}
