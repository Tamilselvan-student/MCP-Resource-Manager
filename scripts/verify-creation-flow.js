import pool from '../dist/database.js';
import { OpenFgaClient } from '@openfga/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fgaClient = new OpenFgaClient({
    apiUrl: process.env.FGA_API_URL || 'http://localhost:8080',
    storeId: process.env.FGA_STORE_ID,
    authorizationModelId: process.env.FGA_MODEL_ID,
});

async function verifyCreationFlow() {
    console.log('🧪 Testing User Creation & Tuple Logic...');

    try {
        // We will simulate the "logic" of creating a user, or actually verify the end state if we created one via API.
        // Since we can't easily curl POST from here without auth token, we'll verify the FGA state for an EXISTING viewer/editor created recently,
        // OR we can manually invoke the FGA check for a hypothetical user to prove the relation exists.

        // Note: server.ts logic adds 'user:' prefix to the userId provided in the body.
        // If our DB has 'viewer1', the FGA ID is 'user:viewer1'.
        // If our DB has 'user:user:viewer1', the FGA ID is 'user:user:viewer1' (which would be bad).
        // Let's assume standard 'viewer1' -> 'user:viewer1'.

        const testCases = [
            { user: 'user:viewer1', group: 'group:viewers', role: 'viewer' },
            { user: 'user:editor1', group: 'group:editors', role: 'editor' }
        ];

        for (const test of testCases) {
            console.log(`\n🔍 Checking ${test.role} (${test.user})...`);

            const check = await fgaClient.check({
                user: test.user,
                relation: 'member',
                object: test.group
            });

            if (check.allowed) {
                console.log(`   ✅ SUCCESS: ${test.user} is a member of ${test.group}`);
            } else {
                console.log(`   ❌ FAILURE: ${test.user} is NOT a member of ${test.group}`);
                console.log(`      (This implies the tuple was NOT created during creation/backfill)`);
            }
        }

    } catch (err) {
        console.error('❌ Error testing flow:', err);
    } finally {
        process.exit(0);
    }
}

verifyCreationFlow();
