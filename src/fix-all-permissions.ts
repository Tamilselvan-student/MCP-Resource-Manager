import pool from './database.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixAllPermissions() {
    console.log('🔧 Comprehensive OpenFGA Permission Fix\n');
    console.log('='.repeat(60));

    try {
        // ==========================================
        // PART 1: Fix User Group Membership
        // ==========================================
        console.log('\n📋 PART 1: Adding users to their OpenFGA groups...\n');

        const usersResult = await pool.query(`
            SELECT uuid, username, email, role 
            FROM users 
            WHERE role IN ('viewer', 'editor')
            ORDER BY role, username
        `);

        const users = usersResult.rows;
        console.log(`Found ${users.length} viewers/editors to process\n`);

        let userSuccessCount = 0;
        let userErrorCount = 0;

        for (const user of users) {
            const groupName = `group:${user.role}s`;
            const userFgaId = `user:${user.uuid}`;

            console.log(`${user.username} (${user.role})`);
            console.log(`  Adding ${userFgaId} to ${groupName}...`);

            try {
                const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        writes: {
                            tuple_keys: [{
                                user: userFgaId,
                                relation: 'member',
                                object: groupName
                            }]
                        }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    if (errorText.includes('duplicate') || errorText.includes('already exists') || errorText.includes('cannot write a tuple which already exists')) {
                        console.log(`  ℹ️  Already in group`);
                        userSuccessCount++;
                    } else {
                        console.error(`  ❌ Failed:`, errorText);
                        userErrorCount++;
                    }
                } else {
                    console.log(`  ✅ Added to ${groupName}`);
                    userSuccessCount++;
                }
            } catch (error: any) {
                console.error(`  ❌ Error:`, error.message);
                userErrorCount++;
            }
        }

        console.log('\n' + '-'.repeat(60));
        console.log(`Users: ✅ ${userSuccessCount} | ❌ ${userErrorCount}`);
        console.log('-'.repeat(60));

        // ==========================================
        // PART 2: Fix Resource Group Sharing
        // ==========================================
        console.log('\n📋 PART 2: Adding group sharing tuples for resources...\n');

        const resourcesResult = await pool.query(`
            SELECT uuid, resource_type, data, visible_to_viewer, visible_to_editor
            FROM resources
            ORDER BY created_at DESC
        `);

        const resources = resourcesResult.rows;
        console.log(`Found ${resources.length} resources to process\n`);

        let resourceSuccessCount = 0;
        let resourceErrorCount = 0;

        for (const resource of resources) {
            const resourceId = `resource:${resource.uuid}`;
            const resourceName = resource.data?.name || resource.resource_type;

            console.log(`${resourceName}`);
            console.log(`  Viewer: ${resource.visible_to_viewer} | Editor: ${resource.visible_to_editor}`);

            const tuplesToAdd = [];

            if (resource.visible_to_viewer) {
                tuplesToAdd.push({
                    user: 'group:viewers#member',
                    relation: 'viewer',
                    object: resourceId
                });
            }

            if (resource.visible_to_editor) {
                tuplesToAdd.push({
                    user: 'group:editors#member',
                    relation: 'editor',
                    object: resourceId
                });
            }

            if (tuplesToAdd.length === 0) {
                console.log(`  ℹ️  No group sharing needed`);
                continue;
            }

            try {
                const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        writes: {
                            tuple_keys: tuplesToAdd
                        }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    if (errorText.includes('duplicate') || errorText.includes('already exists') || errorText.includes('cannot write a tuple which already exists')) {
                        console.log(`  ℹ️  Tuples already exist`);
                        resourceSuccessCount++;
                    } else {
                        console.error(`  ❌ Failed:`, errorText);
                        resourceErrorCount++;
                    }
                } else {
                    console.log(`  ✅ Added ${tuplesToAdd.length} tuple(s)`);
                    resourceSuccessCount++;
                }
            } catch (error: any) {
                console.error(`  ❌ Error:`, error.message);
                resourceErrorCount++;
            }
        }

        console.log('\n' + '-'.repeat(60));
        console.log(`Resources: ✅ ${resourceSuccessCount} | ❌ ${resourceErrorCount}`);
        console.log('-'.repeat(60));

        console.log('\n' + '='.repeat(60));
        console.log('🎉 COMPLETE!');
        console.log('='.repeat(60));
        console.log(`Total Success: ${userSuccessCount + resourceSuccessCount}`);
        console.log(`Total Errors: ${userErrorCount + resourceErrorCount}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        await pool.end();
    }
}

fixAllPermissions();
