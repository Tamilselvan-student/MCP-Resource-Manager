
import { initDatabase, pool } from '../dist/database.js';

async function restore() {
    try {
        console.log('🔄 Initializing Database (creating tables)...');
        await initDatabase();
        console.log('✅ Tables created.');

        console.log('🔄 Restoring Data from Backups...');

        // Restore Users
        // Check columns in backup vs target
        // We assume they match because backup was taken before migration changes to columns (except maybe we added uuid in backup? No, backup was taken at step 119)
        // Wait, step 119 was AFTER I started thinking about migration but BEFORE I ran SQL to add columns?
        // Let's verify columns in users_backup.

        // Actually, simpler:
        // INSERT INTO users (id, user_id, username, email, password_hash, role, must_change_password, is_active, created_at, updated_at)
        // SELECT id, user_id, username, email, password_hash, role, must_change_password, is_active, created_at, updated_at FROM users_backup;
        // This avoids issues if users_backup has extra columns.

        await pool.query(`
            INSERT INTO users (id, user_id, username, email, password_hash, role, must_change_password, is_active, created_at, updated_at)
            SELECT id, user_id, username, email, password_hash, role, must_change_password, is_active, created_at, updated_at 
            FROM users_backup
            ON CONFLICT (id) DO NOTHING;
        `);
        console.log('✅ Users restored.');

        // Restore Resources
        // Old resources schema: id, resource_type, data, created_by, created_at, visible_to_...
        await pool.query(`
            INSERT INTO resources (id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer)
            SELECT id, resource_type, data, created_by, created_at, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer
            FROM resources_backup
            ON CONFLICT (id) DO NOTHING;
        `);
        console.log('✅ Resources restored.');

        // Fix sequences
        await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
        await pool.query("SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources))");
        console.log('✅ Sequences reset.');

    } catch (e) {
        console.error('❌ Restore failed:', e);
    } finally {
        await pool.end();
    }
}

restore();
