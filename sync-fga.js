
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

async function syncFGA() {
    try {
        console.log('--- SYNC STARTED ---');
        const writes = [];

        // 1. Sync Users (Group Membership)
        const users = await pool.query("SELECT uuid, role FROM users");
        for (const user of users.rows) {
            if (user.role === 'viewer' || user.role === 'editor') {
                writes.push({
                    user: `user:${user.uuid}`,
                    relation: 'member',
                    object: `group:${user.role}s`
                });
            }
        }
        console.log(`Prepared ${writes.length} user group tuples.`);

        // 2. Sync Resources
        const resources = await pool.query("SELECT uuid, created_by, visible_to_viewer, visible_to_editor FROM resources");
        for (const res of resources.rows) {
            // Owner
            writes.push({
                user: `user:${res.created_by}`,
                relation: 'owner',
                object: `resource:${res.uuid}`
            });

            // Viewer Group
            if (res.visible_to_viewer) {
                writes.push({
                    user: 'group:viewers#member',
                    relation: 'viewer',
                    object: `resource:${res.uuid}`
                });
            }

            // Editor Group
            if (res.visible_to_editor) {
                writes.push({
                    user: 'group:editors#member',
                    relation: 'editor',
                    object: `resource:${res.uuid}`
                });
            }
        }
        console.log(`Total tuples to write: ${writes.length}`);

        // 3. Execute Writes in Batches (max 10 is safe for standard FGA limits, though often higher)
        // We'll use 1 for safety and debug-ability since failing a batch fails all.
        // Or actually, simple loop.

        let successCount = 0;
        let failCount = 0;

        for (const tuple of writes) {
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
                    // console.log(`Wrote: ${tuple.user} -> ${tuple.relation} -> ${tuple.object}`);
                } else {
                    const txt = await response.text();
                    // Ignore "duplicate" errors, usually checks are faster than writes but duplicates are fine to ignore
                    if (!txt.includes('duplicate')) {
                        console.error(`Failed to write: ${JSON.stringify(tuple)} - ${txt}`);
                        failCount++;
                    } else {
                        successCount++; // Technically existing is success state
                    }
                }
            } catch (e) {
                console.error('Error writing tuple:', e);
                failCount++;
            }
        }

        console.log(`--- SYNC COMPLETE ---`);
        console.log(`Success/Existing: ${successCount}`);
        console.log(`Failed: ${failCount}`);

    } catch (e) {
        console.error('Sync failed:', e);
    } finally {
        await pool.end();
    }
}

syncFGA();
