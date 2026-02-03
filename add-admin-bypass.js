import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mcp_resources',
    password: 'password',
    port: 5432,
});

const STORE_ID = '01KEPX4H744E7RA0WNQDS6DWA7';
const API_URL = 'http://localhost:8080';

async function addAdminBypass() {
    console.log('=== ADDING ADMIN BYPASS TO ALL RESOURCES ===\n');

    try {
        // Get all resources
        const resources = await pool.query("SELECT uuid, data->>'name' as name FROM resources");

        console.log(`Found ${resources.rows.length} resources\n`);

        const tuplesToAdd = [];

        // Add admin relation to each resource
        for (const resource of resources.rows) {
            tuplesToAdd.push({
                user: 'group:admins#member',
                relation: 'admin',
                object: `resource:${resource.uuid}`
            });
            console.log(`✓ Queued: group:admins → admin → ${resource.name || resource.uuid}`);
        }

        console.log(`\n=== WRITING ${tuplesToAdd.length} TUPLES ===\n`);

        // Write all tuples
        let successCount = 0;
        let skipCount = 0;

        for (const tuple of tuplesToAdd) {
            try {
                const response = await fetch(`${API_URL}/stores/${STORE_ID}/write`, {
                    method: 'POST',
                    body: JSON.stringify({
                        writes: { tuple_keys: [tuple] }
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    successCount++;
                    console.log(`✅ Added: ${tuple.user} → ${tuple.relation} → ${tuple.object}`);
                } else {
                    const txt = await response.text();
                    if (txt.includes('duplicate')) {
                        skipCount++;
                        console.log(`⏭️  Skipped (already exists)`);
                    } else {
                        console.error(`❌ Failed: ${txt}`);
                    }
                }
            } catch (e) {
                console.error('Error writing tuple:', e.message);
            }
        }

        console.log(`\n=== SUMMARY ===`);
        console.log(`Added: ${successCount}`);
        console.log(`Skipped: ${skipCount}`);
        console.log(`Total: ${tuplesToAdd.length}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

addAdminBypass();
