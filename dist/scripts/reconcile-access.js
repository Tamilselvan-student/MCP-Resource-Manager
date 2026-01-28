import pool from '../database.js'; // Adapted path for scripts/ folder
import { OpenFgaClient } from '@openfga/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Load env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const storeId = process.env.FGA_STORE_ID;
const modelId = process.env.FGA_MODEL_ID;
const apiUrl = process.env.FGA_API_URL || 'http://localhost:8080';
const fgaClient = new OpenFgaClient({
    apiUrl,
    storeId,
    authorizationModelId: modelId,
});
async function reconcileAccess() {
    console.log('🔄 Starting Access Reconciliation (Protocol Phase B)...');
    try {
        const res = await pool.query('SELECT id, resource_type, created_by FROM resources');
        const resources = res.rows;
        console.log(`📊 Found ${resources.length} resources.`);
        const writes = [];
        for (const r of resources) {
            if (!r.created_by)
                continue;
            // USE SNAKE CASE to match mcp-handler.ts and avoid FGA syntax errors
            const objectId = `resource:${r.resource_type}_${r.id}`;
            const userId = r.created_by; // e.g. "user:tharsan"
            writes.push({
                user: userId,
                relation: 'owner',
                object: objectId
            });
        }
        if (writes.length === 0) {
            console.log('✅ No tuples to write.');
            return;
        }
        console.log(`📝 Backfilling ${writes.length} tuples...`);
        // Batch write
        const BATCH_SIZE = 10;
        for (let i = 0; i < writes.length; i += BATCH_SIZE) {
            const batch = writes.slice(i, i + BATCH_SIZE);
            try {
                await fgaClient.write({ writes: batch });
                console.log(`   ✅ Backfilled batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            }
            catch (err) {
                console.error(`   ❌ Failed batch: ${err.message}`);
                console.error(`      First object in batch: ${batch[0].object}`);
            }
        }
    }
    catch (err) {
        console.error('❌ Error:', err);
    }
    finally {
        await pool.end();
        process.exit(0);
    }
}
reconcileAccess();
