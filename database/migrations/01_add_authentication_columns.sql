-- ============================================
-- MIGRATION: Add Authentication Columns
-- Description: Adds email, password, and auth fields to users table
-- ============================================

BEGIN;

-- ============================================
-- PHASE 1: Add columns as NULLABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

-- ============================================
-- PHASE 2: Populate with default values
-- ============================================
UPDATE users SET email = username || '@example.com' WHERE email IS NULL;
UPDATE users SET password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE password_hash IS NULL;
UPDATE users SET must_change_password = TRUE WHERE must_change_password IS NULL;
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;

-- ============================================
-- PHASE 3: Add constraints
-- ============================================
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE users ALTER COLUMN must_change_password SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;

-- Add unique constraint (drop first if exists for idempotency)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- ============================================
-- PHASE 4: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- PHASE 5: Verification
-- ============================================
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    RAISE NOTICE '✓ Migration completed successfully';
    RAISE NOTICE '✓ % users migrated with authentication fields', user_count;
END $$;

-- Show migrated users
SELECT 
    user_id,
    username,
    email,
    must_change_password,
    is_active
FROM users
ORDER BY created_at;

COMMIT;
