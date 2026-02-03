
import fetch from 'node-fetch'; // Actually, native fetch is available in Node 18+, package.json says module type so we can use fetch

const STORE_ID = '01KEPX4H744E7RA0WNQDS6DWA7';
const API_URL = 'http://localhost:8080';
const RESOURCE_UUID = '26b248ef-3774-47fd-ae12-b21fd3af61aa';
const OWNER_UUID = '583d20e7-316d-4c81-a5fc-60e4bb0e107a';

async function writeTuples() {
    const writes = [
        // Owner tuple
        {
            user: `user:${OWNER_UUID}`,
            relation: 'owner',
            object: `resource:${RESOURCE_UUID}`
        },
        // Viewer group tuple (because visible_to_viewer is true)
        {
            user: 'group:viewers#member',
            relation: 'viewer',
            object: `resource:${RESOURCE_UUID}`
        }
    ];

    console.log('Writing tuples:', JSON.stringify(writes, null, 2));

    try {
        const response = await fetch(`${API_URL}/stores/${STORE_ID}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                writes: { tuple_keys: writes }
            })
        });

        if (!response.ok) {
            console.error('Failed to write tuples:', await response.text());
        } else {
            console.log('✅ Tuples written successfully');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

writeTuples();
