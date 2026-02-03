
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import 'dotenv/config';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function check() {
    try {
        console.log('Checking USERS integrity...');
        const dups = await pool.query('SELECT id, count(*) FROM users GROUP BY id HAVING count(*) > 1');
        if (dups.rows.length > 0) console.log('❌ Duplicates found:', dups.rows);
        else console.log('✅ No ID duplicates.');

        const nulls = await pool.query('SELECT count(*) FROM users WHERE id IS NULL');
        if (parseInt(nulls.rows[0].count) > 0) console.log('❌ NULL IDs found:', nulls.rows[0].count);
        else console.log('✅ No NULL IDs.');

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
