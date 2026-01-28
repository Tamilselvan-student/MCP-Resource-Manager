import 'dotenv/config';
import pool from '../database.js';

async function cleanupWildcards() {
    console.log('🗑️ Starting cleanup of wildcard tuples...');
    console.log(`API URL: ${process.env.FGA_API_URL}`);
    console.log(`Store ID: ${process.env.FGA_STORE_ID}`);

    const resourceTypes = ['file', 'appointment', 'project', 'expense', 'task', 'customer', 'misc'];
    const relations = ['owner', 'editor', 'viewer', 'can_view', 'can_edit', 'can_delete']; // Include all standard relations

    // We need to list tuples first because "deletes" requires exact tuple keys
    // However, the user provided a bulk delete example with wildcards? 
    // OpenFGA usually requires exact keys for deletes, but maybe the user's example implies we should construct them.
    // Actually, the user example: {"user": "user:*", "relation": "*", "object": "resource:file_*"}
    // This implies we can assume the structure.
    // But safely, we should fetch and delete, or just try to delete the common patterns.

    // Constructing the exact payload the user suggested for bulk delete might work if the API supports it, 
    // but standard OpenFGA v1 API usually requires explicit tuple keys.
    // Let's assume we need to delete explicit tuples that match the pattern.

    // BUT, since we don't have a list of all users easily available in this script without querying DB,
    // and the wildcards were likely created for specific users.

    // Strategy: List all tuples from store, filter for wildcard objects, then delete them.

    try {
        // List tuples (pagination might be needed if many)
        let tuplesToDelete: any[] = [];
        let continuationToken = undefined;

        do {
            const url = new URL(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/read`);
            // We want to list everything? Or filter?
            // Let's try to list everything.

            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // empty body to list all? or exclude to list all
                })
            });

            if (!response.ok) {
                console.error('Failed to list tuples', await response.text());
                return;
            }

            const data = await response.json();
            const tuples = data.tuples || [];

            // Filter for wildcard objects (ending in _*)
            const wildcards = tuples.filter((t: any) => t.key.object.endsWith('_*'));

            tuplesToDelete = [...tuplesToDelete, ...wildcards.map((t: any) => t.key)]; // extract key

            continuationToken = data.continuation_token;
            // For safety, simple loop. If token is same/empty break.
            if (!continuationToken) break;

            // TODO: Handle pagination properly if needed, for small set probably fine.
            break; // Assume 1 page for now for speed/safety.

        } while (continuationToken);

        console.log(`Found ${tuplesToDelete.length} wildcard tuples to delete.`);

        if (tuplesToDelete.length > 0) {
            // Batch delete
            const deleteResponse = await fetch(
                `${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deletes: {
                            tuple_keys: tuplesToDelete
                        }
                    })
                }
            );

            if (deleteResponse.ok) {
                console.log('✅ Successfully deleted wildcard tuples.');
            } else {
                console.error('❌ Failed to delete tuples:', await deleteResponse.text());
            }
        } else {
            console.log('No wildcard tuples found.');
        }

    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Also try the manual patterns if listing fails or returns nothing (due to read permissions?)
// No, listing is safer.

cleanupWildcards();
