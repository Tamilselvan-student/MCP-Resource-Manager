import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const STORE_ID = process.env.FGA_STORE_ID;
const API_URL = process.env.FGA_API_URL || 'http://localhost:8080';

// Command to list models
const cmd = `.\\fga.exe model list --store-id ${STORE_ID} --api-url ${API_URL}`;

try {
    console.log('Fetching models...');
    const stdout = execSync(cmd).toString();
    const result = JSON.parse(stdout);

    if (result.authorization_models && result.authorization_models.length > 0) {
        // Sort by created_at desc just in case
        const models = result.authorization_models.sort((a, b) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const latestModel = models[0];
        console.log(`Latest Model ID: ${latestModel.id}`);

        // Update .env
        let envContent = fs.readFileSync('.env', 'utf8');
        const regex = /FGA_MODEL_ID=.*/;
        const newLine = `FGA_MODEL_ID=${latestModel.id}`;

        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, newLine);
        } else {
            envContent += `\n${newLine}`;
        }

        fs.writeFileSync('.env', envContent);
        console.log('✅ Updated .env with new Model ID.');
    } else {
        console.error('No models found.');
    }

} catch (e) {
    console.error('Error:', e.message);
}
