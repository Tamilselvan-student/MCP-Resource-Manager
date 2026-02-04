import pool from './database.js';
async function testConfig() {
    console.log('Testing DB connection...');
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('DB Time:', res.rows[0].now);
    }
    catch (e) {
        console.error('DB Error:', e);
    }
    finally {
        await pool.end();
    }
}
testConfig();
