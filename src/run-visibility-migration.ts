import pool from './database.js';

async function runMigration() {
    try {
        console.log('🔄 Running visibility columns migration...');

        // Add visibility columns
        await pool.query(`
            ALTER TABLE resources 
              ADD COLUMN IF NOT EXISTS visible_to_owner BOOLEAN DEFAULT TRUE,
              ADD COLUMN IF NOT EXISTS visible_to_admin BOOLEAN DEFAULT TRUE,
              ADD COLUMN IF NOT EXISTS visible_to_editor BOOLEAN DEFAULT TRUE,
              ADD COLUMN IF NOT EXISTS visible_to_viewer BOOLEAN DEFAULT TRUE
        `);

        // Set all existing resources visible to all roles
        await pool.query(`
            UPDATE resources SET 
              visible_to_owner = TRUE,
              visible_to_admin = TRUE,
              visible_to_editor = TRUE,
              visible_to_viewer = TRUE
            WHERE visible_to_owner IS NULL
        `);

        // Create index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_resources_visibility ON resources(
              visible_to_owner,
              visible_to_admin,
              visible_to_editor,
              visible_to_viewer
            )
        `);

        // Verify
        const result = await pool.query(`
            SELECT 
              COUNT(*) as total_resources,
              SUM(CASE WHEN visible_to_admin THEN 1 ELSE 0 END) as visible_to_admin,
              SUM(CASE WHEN visible_to_editor THEN 1 ELSE 0 END) as visible_to_editor,
              SUM(CASE WHEN visible_to_viewer THEN 1 ELSE 0 END) as visible_to_viewer
            FROM resources
        `);

        console.log('✅ Migration complete!');
        console.log('📊 Summary:', result.rows[0]);

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
