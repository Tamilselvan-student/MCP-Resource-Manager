import pool from '../dist/database.js'; // Pointing to compiled database.js
import { OpenFgaClient } from '@openfga/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const storeId = process.env.FGA_STORE_ID;
const modelId = process.env.FGA_MODEL_ID;
const apiUrl = process.env.FGA_API_URL || 'http://localhost:8080';

const fgaClient = new OpenFgaClient({
    apiUrl,
    storeId,
    authorizationModelId: modelId,
});

// Helper to normalize user ID
function normalizeUser(id) {
    if (!id) return null;
    return id.startsWith('user:') ? id : `user:${id}`;
}

async function reconcileAccess() {
    console.log('🔄 Starting "Grand Unification" Backfill (Groups + Owners) - Normalized IDs...');

    try {
        const writes = [];

        // 1. GROUP MIGRATION (Users -> Groups)
        const userRes = await pool.query('SELECT user_id, username, role FROM users');

        for (const u of userRes.rows) {
            const userId = normalizeUser(u.user_id);
            if (!userId) continue;

            // Map DB Role 'editor' -> FGA Group 'editors'
            // Map DB Role 'viewer' -> FGA Group 'viewers'
            const role = u.role;
            if (role === 'viewer' || role === 'editor') {
                const groupName = `${role}s`; // viewers, editors
                writes.push({
                    user: userId,
                    relation: 'member',
                    object: `group:${groupName}`
                });
                // console.log(`   ➕ Staging Group: ${userId} -> group:${groupName}`);
            }
        }

        // 2. RESOURCE MIGRATION (Resources -> Owners & Shared)
        const resQuery = await pool.query('SELECT id, resource_type, created_by, visible_to_viewer FROM resources');

        for (const r of resQuery.rows) {
            if (!r.created_by) continue;

            const objectId = `resource:${r.id}`; // Protocol Format
            const userId = normalizeUser(r.created_by);

            // A. Owner Tuple
            writes.push({
                user: userId,
                relation: 'owner',
                object: objectId
            });

            // B. Shared Access (Hydrate "Visible to Viewers" -> group:viewers)
            if (r.visible_to_viewer) {
                writes.push({
                    user: `group:viewers#member`,
                    relation: 'viewer',
                    object: objectId
                });
                // console.log(`   ➕ Staging Shared: group:viewers -> ${objectId}`);
            }
        }

        // 3. EXECUTE WRITES
        if (writes.length === 0) {
            console.log('✅ No tuples to write.');
            process.exit(0);
        }

        console.log(`🚀 Writing ${writes.length} tuples to OpenFGA...`);

        const BATCH_SIZE = 10;
        let successCount = 0;

        for (let i = 0; i < writes.length; i += BATCH_SIZE) {
            const batch = writes.slice(i, i + BATCH_SIZE);
            try {
                await fgaClient.write({ writes: batch });
                successCount += batch.length;
                process.stdout.write('.');
            } catch (err) {
                console.error(`\n❌ Batch failed:`);
                if (err.message) console.error(err.message);
                console.error(`   First Item: ${JSON.stringify(batch[0])}`);
            }
        }

        console.log(`\n✅ Backfill Complete (${successCount}/${writes.length} written).`);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
    } finally {
        process.exit(0);
    }
}

reconcileAccess();
