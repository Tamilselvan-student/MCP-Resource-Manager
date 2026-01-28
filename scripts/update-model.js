import { OpenFgaClient } from '@openfga/sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiUrl = process.env.FGA_API_URL || 'http://localhost:8080';
const storeId = process.env.FGA_STORE_ID;

const fgaClient = new OpenFgaClient({
    apiUrl,
    storeId,
});

async function updateModel() {
    console.log('🚀 Deploying new FGA Model (Schema 1.1 with Groups)...');

    try {
        // Correct JSON Schema for "viewer: [user, group#member] or owner"
        const typeDefs = [
            { type: 'user', relations: {} },
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
                                { this: {} }, // [user, group#member] handled by metadata
                                { computedUserset: { object: '', relation: 'owner' } }
                            ]
                        }
                    },
                    editor: {
                        union: {
                            child: [
                                { this: {} }, // [user, group#member] handled by metadata
                                { computedUserset: { object: '', relation: 'owner' } }
                            ]
                        }
                    },
                    can_view: { computedUserset: { object: '', relation: 'viewer' } },
                    can_edit: { computedUserset: { object: '', relation: 'editor' } },
                    can_delete: { computedUserset: { object: '', relation: 'owner' } }
                },
                metadata: {
                    relations: {
                        owner: { directly_related_user_types: [{ type: 'user' }] },
                        viewer: {
                            directly_related_user_types: [
                                { type: 'user' },
                                { type: 'group', relation: 'member' }
                            ]
                        },
                        editor: {
                            directly_related_user_types: [
                                { type: 'user' },
                                { type: 'group', relation: 'member' }
                            ]
                        },
                        can_view: { directly_related_user_types: [] },
                        can_edit: { directly_related_user_types: [] },
                        can_delete: { directly_related_user_types: [] }
                    }
                }
            }
        ];

        const response = await fgaClient.writeAuthorizationModel({
            schema_version: '1.1',
            type_definitions: typeDefs
        });

        console.log(`✅ Model Deployed! Model ID: ${response.authorization_model_id}`);
        console.log(`✅ Model Deployed! Model ID: ${response.authorization_model_id}`);
        fs.writeFileSync('temp_model_id.txt', response.authorization_model_id);
        console.log(`⚠️  Make sure to update .env with FGA_MODEL_ID=${response.authorization_model_id}`);

    } catch (err) {
        console.error('❌ Error deploying model:');
        if (err.response && err.response.data) {
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err);
        }
    }
}

updateModel();
