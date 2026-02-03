
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

async function restoreTable(backupName, targetName, constraintsFn) {
    console.log(`🔹 Restoring ${targetName} from ${backupName}...`);

    // Get columns
    const res = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
    `, [backupName]);

    if (res.rows.length === 0) {
        throw new Error(`Backup table ${backupName} not found!`);
    }

    const cols = res.rows;

    // Build CREATE TABLE
    const defs = cols.map(c => {
        let type = c.data_type;
        // Fix Serial
        if (c.column_name === 'id' && type === 'integer') {
            // In restore, we want it to be SERIAL implies auto-increment.
            return `id SERIAL PRIMARY KEY`;
        }

        let def = `${c.column_name} ${type}`;
        // if (c.is_nullable === 'NO') def += ' NOT NULL'; // Constraints might fail if data matches but let's be safe? 
        // Actually, users_backup has raw types. 
        // Let's just create table compatible.
        return def;
    });

    const createSql = `CREATE TABLE ${targetName} (\n  ${defs.join(',\n  ')}\n)`;
    console.log(`sql: ${createSql}`);

    await pool.query(createSql);

    // Insert Data
    // Use column names to be Safe
    const colNames = cols.map(c => c.column_name).join(', ');
    await pool.query(`INSERT INTO ${targetName} (${colNames}) SELECT ${colNames} FROM ${backupName}`);
    console.log(`✅ Data inserted into ${targetName}`);

    // Apply constraints
    if (constraintsFn) await constraintsFn();

    // Reset Sequence
    await pool.query(`SELECT setval('${targetName}_id_seq', (SELECT MAX(id) FROM ${targetName}))`);
}

async function run() {
    try {
        await pool.query('BEGIN');

        await restoreTable('users_backup', 'users', async () => {
            await pool.query('ALTER TABLE users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id)');
            await pool.query('ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)');
            // Attempt to add NOT NULLs if possible? 
            // Let's stick to basics.
        });

        await restoreTable('resources_backup', 'resources', async () => {
            // Constraints?
        });

        await pool.query('COMMIT');
        console.log('✅ Restoration Complete!');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('❌ Restore ERROR:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
