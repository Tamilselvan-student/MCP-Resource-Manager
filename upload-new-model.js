import fetch from 'node-fetch';
import fs from 'fs';

const STORE_ID = '01KEPX4H744E7RA0WNQDS6DWA7';
const API_URL = 'http://localhost:8080';

async function uploadModel() {
    console.log('=== UPLOADING NEW OPENFGA MODEL ===\n');

    try {
        // Read the new model
        const modelContent = fs.readFileSync('model-with-admin-bypass.fga', 'utf8');

        console.log('Model content:');
        console.log(modelContent);
        console.log('\n');

        // Upload to OpenFGA
        const response = await fetch(`${API_URL}/stores/${STORE_ID}/authorization-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schema_version: '1.1',
                type_definitions: modelContent
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Failed to upload model:', error);
            return;
        }

        const result = await response.json();
        const newModelId = result.authorization_model_id;

        console.log('✅ Model uploaded successfully!');
        console.log(`New Model ID: ${newModelId}\n`);

        console.log('📝 NEXT STEPS:');
        console.log(`1. Update .env file:`);
        console.log(`   FGA_MODEL_ID=${newModelId}`);
        console.log(`2. Restart your server`);
        console.log(`3. Run: node add-admin-bypass.js`);
        console.log(`4. Run: node fga-health-check.js`);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

uploadModel();
