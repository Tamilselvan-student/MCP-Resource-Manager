-- Fix existing users to require password change
-- This updates all users who have the default password hash to must_change_password = true

UPDATE users 
SET must_change_password = true
WHERE password_hash = '$2b$10$wg54GkbeWXXV5FS6GeB3lORJY1rGayouwR7Si78U1fNqv/GBf.5fu'
  AND must_change_password = false;

-- Show updated users
SELECT user_id, email, must_change_password 
FROM users 
ORDER BY created_at;
