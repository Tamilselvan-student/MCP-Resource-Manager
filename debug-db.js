
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mcp_resources',
    password: 'password', // Hardcoded
    port: 5432,
});

async function run() {
    try {
        console.log('Querying...');
        const r = await pool.query("SELECT uuid, created_by, visible_to_viewer FROM resources WHERE data->>'name' = 'Scenario_File_1_project.txt'");
        const u = await pool.query("SELECT uuid FROM users WHERE role = 'viewer' LIMIT 1");

        let out = '';
        if (r.rows.length > 0) {
            const row = r.rows[0];
            out += `ResourceUUID:${row.uuid}\nOwnerUUID:${row.created_by}\nVisibleToViewer:${row.visible_to_viewer}\n`;
        } else {
            out += 'RESOURCE_NOT_FOUND\n';
        }

        if (u.rows.length > 0) {
            out += 'ViewerUUID:' + u.rows[0].uuid + '\n';
        } else {
            out += 'VIEWER_NOT_FOUND\n';
        }

        fs.writeFileSync('debug_output.txt', out);
        console.log('DONE');
    } catch (e) {
        console.error(e);
        fs.writeFileSync('debug_output.txt', 'ERROR:' + e.message);
    } finally {
        await pool.end();
    }
}
run();
