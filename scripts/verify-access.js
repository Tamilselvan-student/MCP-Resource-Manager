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

function normalizeUser(id) {
    if (!id) return null;
    return id.startsWith('user:') ? id : `user:${id}`;
}

async function verifyAccess() {
    console.log('🕵️‍♀️ Verifying Access for viewer1...');

    try {
        // 1. Find the user
        const userQuery = await pool.query("SELECT * FROM users WHERE username = 'viewer1' OR email LIKE '%viewer1%'");
        if (userQuery.rows.length === 0) {
            console.log('❌ Could not find user "viewer1" in database.');
            process.exit(0);
        }

        const user = userQuery.rows[0];
        const userId = normalizeUser(user.user_id);
        console.log(`✅ Found User: ${user.username} (ID: ${userId})`);

        // 2. Find TEST2.pdf specifically
        const resourceQuery = await pool.query("SELECT * FROM resources WHERE data::text LIKE '%TEST2.pdf%' OR data::text LIKE '%TEST2%'");

        if (resourceQuery.rows.length === 0) {
            console.log(`❌ TEST2.pdf not found in DB.`);
            process.exit(0);
        }

        const resource = resourceQuery.rows[0];
        const objectId = `resource:${resource.id}`;

        console.log(`✅ Found Resource: ${resource.data?.name || resource.id} (Object: ${objectId})`);

        // 3. Check OpenFGA Permissions
        console.log('\n🔍 Chain Debugging:');

        // A. Check Group Membership
        console.log(`   A. Is ${userId} a member of group:viewers?`);
        const checkGroup = await fgaClient.check({
            user: userId,
            relation: 'member',
            object: 'group:viewers'
        });
        console.log(`      Result: ${checkGroup.allowed ? '✅ YES' : '❌ NO'}`);

        console.log('\n🔍 Check 2: Can View? (Computed via Owner OR Group/Role)');
        const checkView = await fgaClient.check({
            user: userId,
            relation: 'can_view',
            object: objectId
        });
        console.log(`   Result: ${checkView.allowed ? '✅ YES' : '❌ NO'}`);

        if (checkView.allowed) {
            console.log('\n🎉 SUCCESS: The assertion passes. The user can view the file.');
        } else {
            console.log('\n⚠️ FAILURE: The user cannot view the file in FGA.');
        }

    } catch (err) {
        console.error('❌ Error during verification:', err);
    } finally {
        process.exit(0);
    }
}

verifyAccess();
