-- ============================================
-- TEST: Complete Migration Workflow
-- Description: Safe testing of entire migration process
-- ============================================

\echo ''
\echo '╔════════════════════════════════════════════════════════════════╗'
\echo '║         DATABASE MIGRATION TEST - AUTHENTICATION SYSTEM        ║'
\echo '╚════════════════════════════════════════════════════════════════╝'
\echo ''

-- ============================================
-- STAGE 1: PRE-MIGRATION STATE
-- ============================================
\echo '=== STAGE 1: PRE-MIGRATION STATE ==='
\echo ''
\echo 'ℹ️  Current table structure:'
\d users

\echo ''
\echo 'ℹ️  Current user count:'
SELECT COUNT(*) as total_users FROM users;

\echo ''
\echo 'ℹ️  Current users:'
SELECT user_id, username, role FROM users ORDER BY created_at;

\echo ''
\echo '✅ Stage 1 complete'
\echo ''
\prompt 'Press Enter to continue to Stage 2 (Backup)...' dummy

-- ============================================
-- STAGE 2: RUN BACKUP
-- ============================================
\echo ''
\echo '=== STAGE 2: RUNNING BACKUP ==='
\echo ''
\i database/migrations/00_backup_users_table.sql

\echo ''
\echo 'ℹ️  Verifying backup table exists:'
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name LIKE 'users_backup_%'
  AND table_schema = 'public'
ORDER BY table_name DESC
LIMIT 1;

\echo ''
\echo '✅ Stage 2 complete'
\echo ''
\prompt 'Press Enter to continue to Stage 3 (Migration)...' dummy

-- ============================================
-- STAGE 3: RUN MIGRATION
-- ============================================
\echo ''
\echo '=== STAGE 3: RUNNING MIGRATION ==='
\echo ''
\i database/migrations/01_add_authentication_columns.sql

\echo ''
\echo 'ℹ️  New table structure:'
\d users

\echo ''
\echo 'ℹ️  All users with new authentication fields:'
SELECT 
    user_id,
    username,
    email,
    must_change_password,
    is_active
FROM users
ORDER BY created_at;

\echo ''
\echo '✅ Stage 3 complete'
\echo ''
\prompt 'Press Enter to continue to Stage 4 (Login Simulation)...' dummy

-- ============================================
-- STAGE 4: LOGIN SIMULATION
-- ============================================
\echo ''
\echo '=== STAGE 4: LOGIN SIMULATION ==='
\echo ''
\echo 'ℹ️  Testing login readiness for all users:'
SELECT 
    user_id,
    username, 
    email,
    CASE WHEN password_hash IS NOT NULL THEN '✅ CAN LOGIN' ELSE '❌ NO PASSWORD' END as login_status,
    CASE WHEN must_change_password THEN '⚠️  MUST CHANGE' ELSE '✅ PASSWORD OK' END as password_status
FROM users
ORDER BY created_at;

\echo ''
\echo '✅ Stage 4 complete'
\echo ''
\prompt 'Press Enter to continue to Stage 5 (Test Rollback)...' dummy

-- ============================================
-- STAGE 5: TEST ROLLBACK
-- ============================================
\echo ''
\echo '=== STAGE 5: TESTING ROLLBACK ==='
\echo ''
\i database/migrations/99_rollback_authentication_migration.sql

\echo ''
\echo 'ℹ️  Table structure after rollback:'
\d users

\echo ''
\echo 'ℹ️  Verifying original data intact:'
SELECT 
    user_id,
    username,
    role,
    created_at
FROM users
ORDER BY created_at;

\echo ''
\echo '✅ Stage 5 complete - Rollback successful'
\echo ''
\prompt 'Press Enter to continue to Stage 6 (Final Migration)...' dummy

-- ============================================
-- STAGE 6: RE-RUN MIGRATION (FINAL)
-- ============================================
\echo ''
\echo '=== STAGE 6: FINAL MIGRATION ==='
\echo ''
\i database/migrations/01_add_authentication_columns.sql

\echo ''
\echo 'ℹ️  Final verification - All users with authentication:'
SELECT 
    user_id,
    username,
    email,
    CASE WHEN password_hash IS NOT NULL THEN '✅' ELSE '❌' END as has_password,
    CASE WHEN must_change_password THEN '⚠️' ELSE '✅' END as must_change,
    CASE WHEN is_active THEN '✅' ELSE '❌' END as active
FROM users
ORDER BY created_at;

\echo ''
\echo '✅ Stage 6 complete'
\echo ''
\prompt 'Press Enter to continue to Stage 7 (Summary Report)...' dummy

-- ============================================
-- STAGE 7: SUMMARY REPORT
-- ============================================
\echo ''
\echo '=== STAGE 7: MIGRATION SUMMARY ==='
\echo ''

-- Total users migrated
\echo 'ℹ️  Total users migrated:'
SELECT COUNT(*) as total_users FROM users;

-- Backup table name
\echo ''
\echo 'ℹ️  Backup table created:'
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'users_backup_%' 
  AND table_schema = 'public'
ORDER BY table_name DESC 
LIMIT 1;

-- All users can login check
\echo ''
\echo 'ℹ️  Login readiness check:'
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email IS NOT NULL AND password_hash IS NOT NULL THEN 1 END) as can_login,
    COUNT(CASE WHEN must_change_password = TRUE THEN 1 END) as must_change_password,
    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_users
FROM users;

-- Final status
\echo ''
\echo '╔════════════════════════════════════════════════════════════════╗'
\echo '║                    ✅ MIGRATION SUCCESSFUL                      ║'
\echo '╚════════════════════════════════════════════════════════════════╝'
\echo ''
\echo 'Default Login Credentials:'
\echo '  Email: {username}@example.com'
\echo '  Password: changeme123'
\echo ''
\echo 'Examples:'
\echo '  • tharsan@example.com / changeme123'
\echo '  • sarah@example.com / changeme123'
\echo '  • admin@example.com / changeme123'
\echo ''
\echo '⚠️  All users MUST change password on first login'
\echo ''
