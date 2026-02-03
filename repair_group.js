
import fetch from 'node-fetch';

const STORE_ID = '01KEPX4H744E7RA0WNQDS6DWA7';
const API_URL = 'http://localhost:8080';
const USER_UUID = '583d20e7-316d-4c81-a5fc-60e4bb0e107a';

async function repairGroup() {
    console.log(`Adding User: ${USER_UUID} to group:viewers`);

    const writes = [
        {
            user: `user:${USER_UUID}`,
            relation: 'member',
            object: `group:viewers`
        }
    ];

    try {
        const response = await fetch(`${API_URL}/stores/${STORE_ID}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                writes: { tuple_keys: writes }
            })
        });

        if (!response.ok) {
            console.error('Failed to add user to group:', await response.text());
        } else {
            console.log('✅ User successfully added to group:viewers');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

repairGroup();
