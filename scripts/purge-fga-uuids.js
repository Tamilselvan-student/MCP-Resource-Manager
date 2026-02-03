
import dotenv from 'dotenv';
import 'dotenv/config';

const FGA_API_URL = process.env.FGA_API_URL || 'http://localhost:8080';
const FGA_STORE_ID = process.env.FGA_STORE_ID;

async function purge() {
    console.log('🧹 Purging OpenFGA UUID leftovers...');
    try {
        // Read
        const response = await fetch(`${FGA_API_URL}/stores/${FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await response.json();
        const tuples = data.tuples || [];

        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

        const toDelete = [];

        tuples.forEach(t => {
            const hasUuid = uuidRegex.test(t.key.user) || uuidRegex.test(t.key.object);
            if (hasUuid) {
                toDelete.push(t.key);
            }
        });

        if (toDelete.length === 0) {
            console.log('✅ No UUID tuples to purge.');
            return;
        }

        console.log(`🔥 Deleting ${toDelete.length} UUID tuples...`);

        // Delete in batches
        for (let i = 0; i < toDelete.length; i += 10) {
            const batch = toDelete.slice(i, i + 10);
            await fetch(`${FGA_API_URL}/stores/${FGA_STORE_ID}/write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deletes: { tuple_keys: batch } })
            });
        }

        console.log('✅ Purge Complete.');

    } catch (e) {
        console.error('❌ Purge Failed:', e);
    }
}
purge();
