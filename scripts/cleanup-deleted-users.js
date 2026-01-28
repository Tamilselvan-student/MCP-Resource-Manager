import pool from '../dist/database.js';
import { OpenFgaClient } from '@openfga/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fgaClient = new OpenFgaClient({
    apiUrl: process.env.FGA_API_URL || 'http://localhost:8080',
    storeId: process.env.FGA_STORE_ID,
    authorizationModelId: process.env.FGA_MODEL_ID,
});

async function cleanupDeletedUserTuples() {
    console.log('🧹 Starting cleanup of ghost tuples...');

    try {
        // Step 1: Get all valid user emails/IDs from database
        // We need to support both "user:email" (legacy?) and "user:id" (current)
        // server.ts uses `user:userId` (where userId is a string, often email-like or UUID-like)
        // 06_fix_user_id_type.sql suggests user_id column.

        const validUsersRes = await pool.query('SELECT user_id, email FROM users');
        const validUserIds = new Set(validUsersRes.rows.map(u => u.user_id));
        const validEmails = new Set(validUsersRes.rows.map(u => u.email));

        console.log(`✅ Found ${validUserIds.size} valid users in DB.`);

        // Step 2: Get all tuples from OpenFGA
        // Note: Read without arguments returns everything (might need pagination if large, but SDK handles some?)
        // The SDK read method usually requires a key or returns paginated lists.
        // We'll try reading all tuples with user starting with 'user:'

        // This is a naive "read all" approach. For large stores, we'd need continuation tokens.
        // But for this cleanup, we'll assume it fits or loop.

        let allTuples = [];
        let continuationToken = undefined;


        do {
            // "read" with no body key lists all tuples? 
            // The FGA SDK usually requires at least one user/relation/object filter or specific syntax for "everything".
            // Let's try reading all by User=* (if supported) or just scan known types if wildcard read not supported.
            // Actually, best way to scan is usually by type if store is large.
            // For now, let's try reading specifically for tuples where user is a "user:..." 
            // But we don't know the IDs.
            // Standard FGA pattern to dump all is null/undefined filter?
            const k = {};
            const response = await fgaClient.read(k, { continuationToken });

            allTuples.push(...(response.tuples || []));
            continuationToken = response.continuation_token;
        } while (continuationToken && continuationToken !== "");

        console.log(`🔍 Scanned ${allTuples.length} tuples in FGA.`);

        const tuplesToDelete = [];

        for (const tuple of allTuples) {
            const userKey = tuple.key.user;
            if (userKey.startsWith('user:')) {
                // Check if this user exists in DB
                // userKey format: "user:tharsan" or "user:some-id"
                const id = userKey.replace('user:', '');

                // We check against known IDs. 
                // Also check emails just in case legacy used emails directly without ID (unlikely given consistent usage, but safe)
                const isValid = validUserIds.has(id) || validUserIds.has(userKey) || validEmails.has(id);

                if (!isValid) {
                    console.log(`   🗑️  Marking ghost tuple: ${userKey} ${tuple.key.relation} ${tuple.key.object}`);
                    tuplesToDelete.push(tuple.key);
                }
            }
        }

        console.log(`Found ${tuplesToDelete.length} tuples from deleted users.`);

        // Step 4: Delete in batches
        const BATCH_SIZE = 1; // Try size 1 to isolate error, then increase
        for (let i = 0; i < tuplesToDelete.length; i += BATCH_SIZE) {
            const batch = tuplesToDelete.slice(i, i + BATCH_SIZE);
            console.log('   Deleting batch:', JSON.stringify(batch));
            try {
                // SDK usage: { deletes: [key1, key2] }
                await fgaClient.write({
                    deletes: batch
                });
                process.stdout.write('.');
            } catch (e) {
                console.error('   ❌ Batch failed:', e.message);
                if (e.body) console.error(JSON.stringify(e.body));
            }
        }

        console.log('\n✅ Cleanup complete!');

    } catch (err) {
        console.error('❌ Error during cleanup:', err);
    } finally {
        process.exit(0);
    }
}

cleanupDeletedUserTuples();
