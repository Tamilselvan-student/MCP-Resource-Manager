import { OpenFgaClient } from '@openfga/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fgaClient = new OpenFgaClient({
    apiUrl: process.env.OPENFGA_API_URL || 'http://localhost:8080',
    storeId: process.env.OPENFGA_STORE_ID,
    authorizationModelId: process.env.OPENFGA_MODEL_ID || undefined,
});

async function main() {
    const user = 'user:7494cbc5-3af0-48de-8185-f4e8a3b920c3';
    const group = 'group:editors';
    const resource = 'resource:b5ebe51a-327a-4ce5-9b48-b91c01d2df41';

    console.log('--- SETTING UP GROUPS ---');

    try {
        // 1. Add User to Group
        console.log(`1. Adding ${user} to ${group}...`);
        await fgaClient.write({
            writes: [{ user, relation: 'member', object: group }],
        });
        console.log('✅ User added to group.');

        // 2. Grant Group Access to Resource
        console.log(`2. Granting ${group}#member editor access to ${resource}...`);
        await fgaClient.write({
            writes: [{ user: `${group}#member`, relation: 'editor', object: resource }],
        });
        console.log('✅ Group access granted.');

        // 3. Verify
        console.log('3. Verifying editor permission for user...');
        const { allowed } = await fgaClient.check({
            user,
            relation: 'editor',
            object: resource
        });
        console.log(`Check result: ${allowed ? '✅ ALLOWED' : '❌ DENIED'}`);

        if (!allowed) {
            console.error('Wait... failing? Check if model supports group#member expansion.');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

main();
