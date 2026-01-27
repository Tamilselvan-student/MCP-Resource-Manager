import pool, { closeDatabase } from './database.js';

async function fixSchema() {
    try {
        console.log('🔄 Attempting to alter user_id column to TEXT...');
        await pool.query(`
            ALTER TABLE users ALTER COLUMN user_id TYPE TEXT;
        `);
        console.log('✅ Successfully altered user_id column to TEXT');
    } catch (error) {
        console.error('❌ Error altering schema:', error);
    } finally {
        await closeDatabase();
    }
}

fixSchema();
