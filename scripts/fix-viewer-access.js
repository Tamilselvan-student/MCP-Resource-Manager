import pool from '../dist/database.js'; // Pointing to compiled database.js
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

async function fixViewer1() {
    console.log('🚑 Emergency Fix for viewer1...');

    try {
        const userId = 'user:viewer1';
        const groupObject = 'group:viewers';

        // 1. Force Membership
        console.log(`1. Adding ${userId} -> ${groupObject}...`);
        try {
            await fgaClient.write({
                writes: [{
                    user: userId,
                    relation: 'member',
                    object: groupObject
                }]
            });
            console.log('   ✅ Added to group.');
        } catch (e) {
            console.log('   ⚠️  Could not add to group (maybe exists):', e.message);
        }

        // 2. Force Share TEST2.pdf
        // Find resource handle
        const resQuery = await pool.query("SELECT id, data FROM resources WHERE data::text LIKE '%TEST2.pdf%'");
        if (resQuery.rows.length === 0) {
            console.log('❌ TEST2.pdf not found in DB!');
            return;
        }
        const resourceId = resQuery.rows[0].id; // UUID
        const objectId = `resource:${resourceId}`;

        console.log(`2. Sharing ${objectId} with group:viewers#member...`);
        try {
            await fgaClient.write({
                writes: [{
                    user: 'group:viewers#member',
                    relation: 'viewer', // CORRECT RELATION
                    object: objectId
                }]
            });
            console.log('   ✅ Shared with group.');
        } catch (e) {
            console.log('   ⚠️  Could not share (maybe exists):', e.message);
        }

        // 3. Verify
        console.log('3. Verifying...');
        const check = await fgaClient.check({
            user: userId,
            relation: 'viewer',
            object: objectId
        });

        console.log(`   Final Access Check: ${check.allowed ? '✅ ALLOWED' : '❌ DENIED'}`);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
    } finally {
        process.exit(0);
    }
}

fixViewer1();
