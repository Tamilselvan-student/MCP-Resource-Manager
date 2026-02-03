
import fetch from 'node-fetch';

const STORE_ID = '01KEPX4H744E7RA0WNQDS6DWA7';
const API_URL = 'http://localhost:8080';
const RESOURCE_UUID = '26b248ef-3774-47fd-ae12-b21fd3af61aa';
const USER_UUID = '583d20e7-316d-4c81-a5fc-60e4bb0e107a';

async function checkPermission() {
    console.log(`Checking permissions for User: ${USER_UUID} on Resource: ${RESOURCE_UUID}`);

    // 1. Check direct check
    try {
        const body = {
            tuple_key: {
                user: `user:${USER_UUID}`,
                relation: 'viewer', // The API checks for 'viewer' relation
                object: `resource:${RESOURCE_UUID}`
            }
        };

        console.log('--- CHECK REQUEST ---');
        console.log(JSON.stringify(body, null, 2));

        const response = await fetch(`${API_URL}/stores/${STORE_ID}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('--- CHECK RESULT ---');
        console.log(JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('Check failed:', e);
    }

    // 2. Check Group Membership
    try {
        console.log('\n--- GROUP MEMBERSHIP CHECK ---');
        // We want to know if user:UUID is related to group:viewers as member
        // We can do a check for that too!
        const body = {
            tuple_key: {
                user: `user:${USER_UUID}`,
                relation: 'member',
                object: `group:viewers`
            }
        };

        const response = await fetch(`${API_URL}/stores/${STORE_ID}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('Is user in group:viewers?', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Group check failed:', e);
    }
}

checkPermission();
