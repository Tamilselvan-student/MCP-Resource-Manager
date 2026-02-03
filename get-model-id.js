import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getLatestModelId() {
    try {
        const { stdout } = await execAsync('fga model list --store-id 01KEPX4H744E7RA0WNQDS6DWA7 --max-pages 1');
        const data = JSON.parse(stdout);

        if (data.authorization_models && data.authorization_models.length > 0) {
            const latestModel = data.authorization_models[0];
            console.log('Latest Model ID:', latestModel.id);
            console.log('\nUpdate your .env file with:');
            console.log(`FGA_MODEL_ID=${latestModel.id}`);
        } else {
            console.log('No models found');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

getLatestModelId();
