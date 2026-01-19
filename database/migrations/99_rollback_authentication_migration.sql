-- ============================================
-- ROLLBACK: Remove Authentication Columns
-- Description: Complete rollback of authentication migration
-- WARNING: This destroys all authentication data!
-- ============================================

BEGIN;

-- Drop index
DROP INDEX IF EXISTS idx_users_email;

-- Drop constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Drop columns
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;
ALTER TABLE users DROP COLUMN IF EXISTS last_login;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✓ Rollback completed. Table restored to original state.';
END $$;

-- Show table structure
\d users

-- Show all users to confirm data preserved
SELECT 
    user_id,
    username,
    role,
    created_at
FROM users
ORDER BY created_at;

COMMIT;
