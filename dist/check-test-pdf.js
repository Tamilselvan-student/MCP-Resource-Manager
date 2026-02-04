import pool from './database.js';
import dotenv from 'dotenv';
dotenv.config();
async function checkTestPdf() {
    console.log('🔍 Checking TEST.pdf permissions...\n');
    try {
        // Find TEST.pdf in database
        const result = await pool.query(`
            SELECT uuid, resource_type, data, visible_to_viewer, visible_to_editor
            FROM resources
            WHERE data->>'name' ILIKE '%TEST.pdf%'
        `);
        if (result.rows.length === 0) {
            console.log('❌ TEST.pdf not found in database');
            return;
        }
        const resource = result.rows[0];
        console.log('Resource from database:');
        console.log(`  UUID: ${resource.uuid}`);
        console.log(`  Name: ${resource.data.name}`);
        console.log(`  visible_to_viewer: ${resource.visible_to_viewer}`);
        console.log(`  visible_to_editor: ${resource.visible_to_editor}`);
        // Check OpenFGA tuples for this resource
        const resourceId = `resource:${resource.uuid}`;
        console.log(`\nChecking OpenFGA tuples for ${resourceId}...`);
        const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tuple_key: {
                    object: resourceId
                }
            })
        });
        const data = await response.json();
        console.log('\nOpenFGA Tuples:');
        if (data.tuples && data.tuples.length > 0) {
            data.tuples.forEach((tuple) => {
                console.log(`  ${tuple.key.user} -> ${tuple.key.relation} -> ${tuple.key.object}`);
            });
        }
        else {
            console.log('  No tuples found!');
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await pool.end();
    }
}
checkTestPdf();
