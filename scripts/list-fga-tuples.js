
import dotenv from 'dotenv';
import 'dotenv/config';
import fs from 'fs';

const FGA_API_URL = process.env.FGA_API_URL || 'http://localhost:8080';
const FGA_STORE_ID = process.env.FGA_STORE_ID;

async function list() {
    console.log('🔍 Listing OpenFGA Tuples...');
    try {
        const response = await fetch(`${FGA_API_URL}/stores/${FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await response.json();
        const tuples = data.tuples || [];

        console.log(`Found ${tuples.length} tuples.`);

        const dump = tuples.map(t => `${t.key.user} -> ${t.key.relation} -> ${t.key.object}`).join('\n');
        fs.writeFileSync('fga_dump.txt', dump);
        console.log('✅ Saved to fga_dump.txt');

    } catch (e) {
        console.error(e);
    }
}
list();
