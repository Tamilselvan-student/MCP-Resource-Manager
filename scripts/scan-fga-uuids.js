
import dotenv from 'dotenv';
import 'dotenv/config';

const FGA_API_URL = process.env.FGA_API_URL || 'http://localhost:8080';
const FGA_STORE_ID = process.env.FGA_STORE_ID;

async function scan() {
    console.log('🔍 Scanning OpenFGA for lingering UUIDs...');
    try {
        const response = await fetch(`${FGA_API_URL}/stores/${FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await response.json();
        const tuples = data.tuples || [];

        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

        let found = 0;
        tuples.forEach(t => {
            const hasUuid = uuidRegex.test(t.key.user) || uuidRegex.test(t.key.object);
            if (hasUuid) {
                console.log(`⚠️  UUID Tuple: ${t.key.user} -> ${t.key.relation} -> ${t.key.object}`);
                found++;
            }
        });

        if (found === 0) console.log('✅ No UUIDs found in OpenFGA.');
        else console.log(`❌ Found ${found} tuples with UUIDs.`);

    } catch (e) {
        console.error(e);
    }
}
scan();
