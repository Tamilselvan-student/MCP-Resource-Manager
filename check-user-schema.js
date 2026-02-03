import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mcp_resources',
    password: 'password',
    port: 5432,
});

async function checkUsers() {
    try {
        const result = await pool.query('SELECT * FROM users LIMIT 1');
        console.log('=== USER COLUMNS ===');
        console.log(Object.keys(result.rows[0]));
        console.log('\n=== SAMPLE USER ===');
        console.log(result.rows[0]);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

checkUsers();
