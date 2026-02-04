import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function updateModel() {
    console.log('🚀 Uploading new OpenFGA Model...\n');

    const storeId = process.env.FGA_STORE_ID;
    const apiUrl = process.env.FGA_API_URL;

    if (!storeId || !apiUrl) {
        console.error('❌ Missing FGA_STORE_ID or FGA_API_URL in .env');
        return;
    }

    try {
        const modelPath = path.resolve('model-independent.fga');
        const modelContent = fs.readFileSync(modelPath, 'utf8');

        console.log(`Reading model from: ${modelPath}`);

        const response = await fetch(`${apiUrl}/stores/${storeId}/authorization-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type_definitions: [
                    { type: 'user' },
                    {
                        type: 'group',
                        relations: {
                            member: { this: {} }
                        },
                        metadata: {
                            relations: {
                                member: { directly_related_user_types: [{ type: 'user' }] }
                            }
                        }
                    },
                    {
                        type: 'resource',
                        relations: {
                            owner: { this: {} },
                            viewer: {
                                union: {
                                    child: [
                                        { this: {} },
                                        { computedUserset: { object: '', relation: 'owner' } }
                                    ]
                                }
                            },
                            editor: {
                                union: {
                                    child: [
                                        { this: {} },
                                        { computedUserset: { object: '', relation: 'owner' } }
                                    ]
                                }
                            },
                            can_edit: { computedUserset: { object: '', relation: 'editor' } },
                            can_view: { computedUserset: { object: '', relation: 'viewer' } },
                            can_delete: { computedUserset: { object: '', relation: 'owner' } }
                        },
                        metadata: {
                            relations: {
                                owner: { directly_related_user_types: [{ type: 'user' }] },
                                viewer: { directly_related_user_types: [{ type: 'user' }, { type: 'group', relation: 'member' }] },
                                editor: { directly_related_user_types: [{ type: 'user' }, { type: 'group', relation: 'member' }] }
                            }
                        }
                    }
                ],
                schema_version: '1.1'
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Failed to upload model:', error);
            return;
        }

        const data = await response.json();
        console.log('\n✅ Model uploaded successfully!');
        console.log(`New Model ID: ${data.authorization_model_id}`);

        // Update .env file
        const envPath = path.resolve('.env');
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Replace FGA_MODEL_ID
        const regex = /FGA_MODEL_ID=.*/;
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `FGA_MODEL_ID=${data.authorization_model_id}`);
        } else {
            envContent += `\nFGA_MODEL_ID=${data.authorization_model_id}`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log('✅ Updated .env file with new Model ID');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

updateModel();
