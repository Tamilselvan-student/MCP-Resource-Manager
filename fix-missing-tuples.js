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

async function fixMissingTuples() {
    console.log('=== FIXING MISSING TUPLES ===\n');

    try {
        // Get all users and check their group memberships
        const users = await pool.query("SELECT uuid, username, role FROM users WHERE role IN ('editor', 'admin')");

        console.log(`Found ${users.rows.length} users with editor/admin roles\n`);

        const tuplesToAdd = [];

        // Add group memberships
        for (const user of users.rows) {
            const groupName = user.role === 'admin' ? 'admins' : `${user.role}s`;
            tuplesToAdd.push({
                user: `user:${user.uuid}`,
                relation: 'member',
                object: `group:${groupName}`
            });
            console.log(`✓ Queued: ${user.username} → group:${groupName}`);
        }

        // Get resource "Doctor" and add owner tuple
        const resources = await pool.query("SELECT uuid, created_by FROM resources WHERE data->>'name' = 'Doctor'");

        if (resources.rows.length > 0) {
            const resource = resources.rows[0];
            tuplesToAdd.push({
                user: `user:${resource.created_by}`,
                relation: 'owner',
                object: `resource:${resource.uuid}`
            });
            console.log(`✓ Queued: Owner tuple for resource "Doctor"`);
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
                        console.log(`⏭️  Skipped (already exists): ${tuple.user} → ${tuple.relation} → ${tuple.object}`);
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

fixMissingTuples();
