import pool, { closeDatabase } from './database.js';
import fs from 'fs';

async function checkSchema() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users';
        `);
        fs.writeFileSync('schema.json', JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await closeDatabase();
    }
}

checkSchema();
