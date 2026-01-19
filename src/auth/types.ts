import { Request } from 'express';

// ============================================
// USER INTERFACE (matches database schema)
// ============================================
export interface User {
    id: string;
    user_id: string;
    username: string;
    email: string;
    password_hash: string;
    role: string;
    must_change_password: boolean;
    last_login: Date | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

// ============================================
// AUTHENTICATED REQUEST (extends Express Request)
// ============================================
export interface AuthRequest extends Request {
    user?: User;
}

// ============================================
// JWT PAYLOAD
// ============================================
export interface JWTPayload {
    userId: string;  // user_id from database (e.g., "user:tharsan")
    email: string;
    role: string;
}

// ============================================
// LOGIN REQUEST
// ============================================
export interface LoginRequest {
    email: string;
    password: string;
}

// ============================================
// CHANGE PASSWORD REQUEST
// ============================================
export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}
