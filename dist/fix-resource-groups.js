import pool from './database.js';
import dotenv from 'dotenv';
dotenv.config();
async function fixResourceGroupSharing() {
    console.log('🔧 Adding group sharing tuples for existing resources...\n');
    try {
        // Get all resources
        const result = await pool.query(`
            SELECT uuid, resource_type, data, visible_to_viewer, visible_to_editor
            FROM resources
            ORDER BY created_at DESC
        `);
        const resources = result.rows;
        console.log(`Found ${resources.length} resources to process:\n`);
        let successCount = 0;
        let errorCount = 0;
        for (const resource of resources) {
            const resourceId = `resource:${resource.uuid}`;
            const resourceName = resource.data?.name || resource.resource_type;
            console.log(`Processing: ${resourceName} (${resource.uuid})`);
            console.log(`  visible_to_viewer: ${resource.visible_to_viewer}`);
            console.log(`  visible_to_editor: ${resource.visible_to_editor}`);
            const tuplesToAdd = [];
            // Add viewer group tuple if visible to viewers
            if (resource.visible_to_viewer) {
                tuplesToAdd.push({
                    user: 'group:viewers#member',
                    relation: 'viewer',
                    object: resourceId
                });
            }
            // Add editor group tuple if visible to editors
            if (resource.visible_to_editor) {
                tuplesToAdd.push({
                    user: 'group:editors#member',
                    relation: 'editor',
                    object: resourceId
                });
            }
            if (tuplesToAdd.length === 0) {
                console.log(`  ℹ️  No group sharing needed (not visible to viewers or editors)`);
                console.log('');
                continue;
            }
            try {
                console.log(`  Adding ${tuplesToAdd.length} tuple(s)...`);
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
                    // Ignore duplicate errors
                    if (errorText.includes('duplicate') || errorText.includes('already exists')) {
                        console.log(`  ℹ️  Tuples already exist (skipping)`);
                        successCount++;
                    }
                    else {
                        console.error(`  ❌ Failed:`, errorText);
                        errorCount++;
                    }
                }
                else {
                    console.log(`  ✅ Added group sharing tuples`);
                    successCount++;
                }
            }
            catch (error) {
                console.error(`  ❌ Error:`, error.message);
                errorCount++;
            }
            console.log('');
        }
        console.log('\n' + '='.repeat(50));
        console.log(`✅ Successfully processed: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('='.repeat(50));
    }
    catch (error) {
        console.error('❌ Database error:', error);
    }
    finally {
        await pool.end();
    }
}
fixResourceGroupSharing();
