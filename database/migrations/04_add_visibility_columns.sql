-- Phase 4B: Add Role-Based Visibility Columns to Resources Table
-- This migration adds visibility control columns for each role

BEGIN;

-- Add visibility columns for each role
ALTER TABLE resources 
  ADD COLUMN IF NOT EXISTS visible_to_owner BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_admin BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_editor BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_viewer BOOLEAN DEFAULT TRUE;

-- Set all existing resources visible to all roles by default
UPDATE resources SET 
  visible_to_owner = TRUE,
  visible_to_admin = TRUE,
  visible_to_editor = TRUE,
  visible_to_viewer = TRUE
WHERE visible_to_owner IS NULL;

-- Create index for faster visibility queries
CREATE INDEX IF NOT EXISTS idx_resources_visibility ON resources(
  visible_to_owner,
  visible_to_admin,
  visible_to_editor,
  visible_to_viewer
);

-- Verify the changes
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'resources'
    AND column_name LIKE 'visible_to_%';
  
  IF col_count = 4 THEN
    RAISE NOTICE '✅ Successfully added 4 visibility columns';
  ELSE
    RAISE EXCEPTION '❌ Expected 4 visibility columns, found %', col_count;
  END IF;
END $$;

COMMIT;

-- Display summary
SELECT 
  COUNT(*) as total_resources,
  SUM(CASE WHEN visible_to_admin THEN 1 ELSE 0 END) as visible_to_admin,
  SUM(CASE WHEN visible_to_editor THEN 1 ELSE 0 END) as visible_to_editor,
  SUM(CASE WHEN visible_to_viewer THEN 1 ELSE 0 END) as visible_to_viewer
FROM resources;
