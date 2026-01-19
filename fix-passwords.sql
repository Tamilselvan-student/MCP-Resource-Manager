-- Fix password hashes for all users
-- Generated hash for password: changeme123

UPDATE users 
SET password_hash = '$2b$10$WLX/zULn5DTWNDKs.WNtLtizD3.SPtry'
WHERE password_hash IS NOT NULL;

-- Verify
SELECT user_id, email, LEFT(password_hash, 30) as hash_preview 
FROM users;
