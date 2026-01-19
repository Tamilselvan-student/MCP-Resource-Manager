-- ============================================
-- BACKUP: Users Table (Dynamic Timestamp)
-- Description: Creates timestamped backup before migration
-- ============================================

\set backup_table_name 'users_backup_' `date +%Y%m%d_%H%M%S`

-- Check if a backup already exists today
DO $$
DECLARE
    backup_exists BOOLEAN;
    backup_name TEXT;
BEGIN
    -- Generate backup table name with current timestamp
    backup_name := 'users_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    
    -- Check if backup table already exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name LIKE 'users_backup_%'
        AND table_schema = 'public'
    ) INTO backup_exists;
    
    IF backup_exists THEN
        RAISE NOTICE '⚠️  Backup table already exists. Skipping backup creation.';
    ELSE
        -- Create backup table
        EXECUTE format('CREATE TABLE %I AS SELECT * FROM users', backup_name);
        RAISE NOTICE '✓ Backup created: %', backup_name;
        
        -- Verify backup
        EXECUTE format('
            SELECT 
                COUNT(*) as backup_count
            FROM %I
        ', backup_name);
        
        RAISE NOTICE '✓ Verified: % rows copied from users table', 
            (SELECT COUNT(*) FROM users);
    END IF;
END $$;

-- Show backup verification
SELECT 
    table_name,
    (xpath('/row/c/text()', 
        query_to_xml(format('SELECT COUNT(*) as c FROM %I', table_name), false, true, ''))
    )[1]::text::int as row_count
FROM information_schema.tables
WHERE table_name LIKE 'users_backup_%'
  AND table_schema = 'public'
ORDER BY table_name DESC
LIMIT 1;
