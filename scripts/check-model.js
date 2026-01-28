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

async function checkModel() {
    console.log('🔍 Checking FGA Model...');
    try {
        const model = await fgaClient.readAuthorizationModel({ id: modelId });
        // Detailed output to see allowed types
        const types = model.authorization_model.type_definitions.map(t => ({
            type: t.type,
            relations: Object.entries(t.relations || {}).map(([name, def]) => ({
                name,
                expression: def
            }))
        }));
        console.log(JSON.stringify(types, null, 2));
    } catch (err) {
        console.error('❌ Error reading model:', err);
    }
}

checkModel();
