-- ============================================
-- MIGRATION: Fix user_id Column Type
-- Description: Changes user_id column from INTEGER (implicit/accidental) to TEXT to match OpenFGA string IDs
-- ============================================

BEGIN;

-- Change column type to TEXT
ALTER TABLE users ALTER COLUMN user_id TYPE TEXT;

-- Verification
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'user_id';
    
    IF col_type = 'text' THEN
        RAISE NOTICE '✓ user_id column is now TEXT';
    ELSE
        RAISE EXCEPTION '❌ Failed to change user_id to TEXT. Current type: %', col_type;
    END IF;
END $$;

COMMIT;
