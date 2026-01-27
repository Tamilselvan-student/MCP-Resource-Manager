import pool from './database.js';
import { OpenFgaClient } from '@openfga/sdk';
import dotenv from 'dotenv';
import { closeDatabase } from './database.js';

dotenv.config();

const storeId = process.env.FGA_STORE_ID;
const modelId = process.env.FGA_MODEL_ID;
const apiUrl = process.env.FGA_API_URL || 'http://localhost:8080';

const fgaClient = new OpenFgaClient({
    apiUrl,
    storeId,
    authorizationModelId: modelId,
});

async function reconcileAccess() {
    console.log('🔄 Starting Access Reconciliation...');
    console.log('   Goal: Grant "owner" permission to creators of existing resources.');

    try {
        // 1. Get all resources
        const res = await pool.query('SELECT id, resource_type, created_by, data FROM resources');
        const resources = res.rows;
        console.log(`📊 Found ${resources.length} resources in database.`);

        const writes = [];

        for (const r of resources) {
            if (!r.created_by) {
                console.warn(`⚠️  Skipping resource ${r.id} (No created_by user)`);
                continue;
            }

            // Construct OpenFGA Object ID
            // Format: resource:type:id (Matching server.ts implementation)
            const objectId = `resource:${r.resource_type}:${r.id}`;
            const user = r.created_by; // This should be "user:tharsan" etc.

            writes.push({
                user: user,
                relation: 'owner',
                object: objectId
            });
        }

        if (writes.length === 0) {
            console.log('✅ No tuples to write.');
            return;
        }

        console.log(`📝 Preparing to write ${writes.length} tuples...`);

        // Write in batches of 10
        const BATCH_SIZE = 10;
        for (let i = 0; i < writes.length; i += BATCH_SIZE) {
            const batch = writes.slice(i, i + BATCH_SIZE);
            try {
                await fgaClient.write({ writes: batch });
                console.log(`   ✅ Wrote batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            } catch (err) {
                console.error(`   ❌ Failed batch:`, err.message);
                // Try individually if batch fails
                for (const w of batch) {
                    try {
                        await fgaClient.write({ writes: [w] });
                        console.log(`      ✅ Retry success: ${w.object}`);
                    } catch (innerErr) {
                        console.error(`      ❌ Retry failed: ${w.object} -> ${innerErr}`);
                    }
                }
            }
        }

        console.log('✅ Reconciliation Complete!');

    } catch (err) {
        console.error('❌ Error during reconciliation:', err);
    } finally {
        await closeDatabase();
        // Force exit to ensure script doesn't hang
        process.exit(0);
    }
}

reconcileAccess();
