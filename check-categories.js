import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mcp_resources',
    password: 'password',
    port: 5432,
});

async function checkCategories() {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY name');
        console.log('=== CATEGORIES ===');
        console.log(result.rows);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

checkCategories();
