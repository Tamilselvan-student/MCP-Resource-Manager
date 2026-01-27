import pool, { closeDatabase } from './database.js';

async function diagnose() {
    console.log('🔍 Starting diagnostics...');
    try {
        // 1. Check Schema
        console.log('\n📊 Checking users table schema...');
        const schemaRes = await pool.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name IN ('id', 'user_id');
        `);
        console.table(schemaRes.rows);

        // 2. Test Query
        console.log('\n🧪 Testing query: SELECT role FROM users WHERE user_id = \'user:John\'');
        const testRes = await pool.query(`
            SELECT role FROM users WHERE user_id = $1
        `, ['user:John']);
        console.log('✅ Query success. Rows:', testRes.rows);

    } catch (error) {
        console.error('\n❌ DIAGNOSTIC ERROR:');
        console.error(error);

        if (error.code === '22P02') {
            console.log('\n💡 Detected Type Mismatch (22P02). Attempting fix...');
            try {
                await pool.query('ALTER TABLE users ALTER COLUMN user_id TYPE TEXT');
                console.log('✅ Altered user_id to TEXT. Retrying query...');
                const retryRes = await pool.query(`SELECT role FROM users WHERE user_id = $1`, ['user:John']);
                console.log('✅ Retry success!');
            } catch (fixErr) {
                console.error('❌ Fix failed:', fixErr);
            }
        }
    } finally {
        await closeDatabase();
    }
}

diagnose();
