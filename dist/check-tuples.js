import dotenv from 'dotenv';
dotenv.config();
async function checkGroupTuples() {
    console.log('🔍 Checking OpenFGA tuples for groups and resources...\n');
    try {
        // Check if viewer3 is in group:viewers
        console.log('1. Checking if user:3ddb38d8-a7d5-4504-994f-f6ce53d6deae is in group:viewers...');
        const userGroupCheck = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tuple_key: {
                    user: 'user:3ddb38d8-a7d5-4504-994f-f6ce53d6deae',
                    relation: 'member',
                    object: 'group:viewers'
                }
            })
        });
        const userGroupData = await userGroupCheck.json();
        console.log('Result:', JSON.stringify(userGroupData, null, 2));
        // Check if group:viewers#member has viewer access to a resource
        console.log('\n2. Checking if group:viewers#member has viewer access to resource:74c3b5e6-7bcd-483f-a9f9-51d8ed099276...');
        const groupResourceCheck = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tuple_key: {
                    user: 'group:viewers#member',
                    relation: 'viewer',
                    object: 'resource:74c3b5e6-7bcd-483f-a9f9-51d8ed099276'
                }
            })
        });
        const groupResourceData = await groupResourceCheck.json();
        console.log('Result:', JSON.stringify(groupResourceData, null, 2));
        // Check all tuples for the resource
        console.log('\n3. Checking ALL tuples for resource:74c3b5e6-7bcd-483f-a9f9-51d8ed099276...');
        const allResourceTuples = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tuple_key: {
                    object: 'resource:74c3b5e6-7bcd-483f-a9f9-51d8ed099276'
                }
            })
        });
        const allResourceData = await allResourceTuples.json();
        console.log('Result:', JSON.stringify(allResourceData, null, 2));
        // Direct permission check
        console.log('\n4. Direct permission check: user:3ddb38d8-a7d5-4504-994f-f6ce53d6deae can view resource:74c3b5e6-7bcd-483f-a9f9-51d8ed099276?');
        const permCheck = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tuple_key: {
                    user: 'user:3ddb38d8-a7d5-4504-994f-f6ce53d6deae',
                    relation: 'viewer',
                    object: 'resource:74c3b5e6-7bcd-483f-a9f9-51d8ed099276'
                }
            })
        });
        const permData = await permCheck.json();
        console.log('Result:', JSON.stringify(permData, null, 2));
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
checkGroupTuples();
