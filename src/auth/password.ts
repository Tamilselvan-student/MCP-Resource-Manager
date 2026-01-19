import bcrypt from 'bcrypt';

// ============================================
// PASSWORD HASHING
// ============================================

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password using bcrypt
 * @param password - Plain text password
 * @returns Bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
    try {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        return hash;
    } catch (error: any) {
        console.error('Error hashing password:', error);
        throw new Error('Failed to hash password');
    }
}

/**
 * Compare a plain text password with a bcrypt hash
 * @param password - Plain text password
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
    try {
        const isMatch = await bcrypt.compare(password, hash);
        return isMatch;
    } catch (error: any) {
        console.error('Error comparing password:', error);
        return false;
    }
}
