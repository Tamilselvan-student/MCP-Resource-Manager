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
    const relation = 'owner';
    const object = 'resource:b5ebe51a-327a-4ce5-9b48-b91c01d2df41';

    console.log(`Writing tuple: { user: ${user}, relation: ${relation}, object: ${object} }`);

    try {
        await fgaClient.write({
            writes: [{ user, relation, object }],
        });
        console.log('✅ Tuple written successfully.');

        console.log('Verifying permission...');
        const { allowed } = await fgaClient.check({ user, relation, object });
        console.log(`Check result: ${allowed ? '✅ ALLOWED' : '❌ DENIED'}`);

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

main();
