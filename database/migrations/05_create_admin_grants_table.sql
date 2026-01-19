-- Migration: Create admin_grants table for audit trail
-- Purpose: Track admin role grants and revocations with reasons

CREATE TABLE IF NOT EXISTS admin_grants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('granted', 'revoked')),
    previous_role VARCHAR(50) NOT NULL,
    new_role VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_grants_user_id ON admin_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_grants_created_at ON admin_grants(created_at DESC);

-- Insert comment
COMMENT ON TABLE admin_grants IS 'Audit trail for admin role grants and revocations';
