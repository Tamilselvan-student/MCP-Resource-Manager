-- Migration to add id and user_id columns back to users table
-- This makes the database compatible with the old codebase

BEGIN;

-- Step 1: Add id column as integer (will be populated from uuid)
ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL;

-- Step 2: Add user_id column as text
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Step 3: Populate user_id from username
UPDATE users 
SET user_id = 'user:' || LOWER(username)
WHERE user_id IS NULL;

-- Step 4: Make columns NOT NULL
ALTER TABLE users ALTER COLUMN id SET NOT NULL;
ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;

-- Step 5: Add unique constraint on user_id
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_id_key;
ALTER TABLE users ADD CONSTRAINT users_user_id_key UNIQUE (user_id);

-- Step 6: Verification
SELECT 
    uuid,
    id,
    user_id,
    username,
    email,
    role
FROM users
ORDER BY created_at;

COMMIT;
