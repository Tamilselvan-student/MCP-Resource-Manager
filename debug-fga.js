
import fs from 'fs';

const STORE_ID = '01KEPX4H744E7RA0WNQDS6DWA7'; // From .env
const API_URL = 'http://localhost:8080';
const RESOURCE_UUID = '26b248ef-3774-47fd-ae12-b21fd3af61aa';
const USER_UUID = '583d20e7-316d-4c81-a5fc-60e4bb0e107a';

async function queryFGA(body) {
    try {
        const response = await fetch(`${API_URL}/stores/${STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { error: e.message };
    }
}

async function run() {
    let output = '';

    console.log('Querying Resource Tuples...');
    const resourceTuples = await queryFGA({
        tuple_key: { object: `resource:${RESOURCE_UUID}` }
    });
    output += '=== RESOURCE TUPLES ===\n' + JSON.stringify(resourceTuples, null, 2) + '\n\n';

    console.log('Querying User Group Memberships...');
    // Query where user is the user part of the tuple (to see what they are a member of)
    // Note: This works if OpenFGA store supports listing by user (it standardly does for simple stores)
    const userTuples = await queryFGA({
        tuple_key: { user: `user:${USER_UUID}` }
    });
    output += '=== USER TUPLES ===\n' + JSON.stringify(userTuples, null, 2) + '\n\n';

    // Also check if group:viewers#member has access to the resource (explicitly) // No, that's covered by resource tuples listing.

    fs.writeFileSync('debug_fga_output.txt', output);
    console.log('DONE');
}

run();
