import 'dotenv/config';
import pool from '../database.js';
async function migrateToIndividualTuples() {
    console.log('🔄 Starting migration to individual resource tuples...');
    try {
        // Get all existing resources
        const resources = await pool.query(`
            SELECT id, data, created_by 
            FROM resources 
            ORDER BY created_at
        `);
        console.log(`📊 Found ${resources.rowCount} resources to migrate`);
        for (const resource of resources.rows) {
            try {
                const resourceName = resource.data?.name;
                if (!resourceName) {
                    console.log(`⚠️  Skipping resource ${resource.id} - no name`);
                    continue;
                }
                if (!resource.created_by) {
                    console.log(`⚠️  Skipping resource ${resourceName} - no created_by`);
                    continue;
                }
                const creatorId = parseInt(resource.created_by);
                if (isNaN(creatorId)) {
                    console.log(`⚠️  Skipping resource ${resourceName} - invalid created_by: ${resource.created_by}`);
                    continue;
                }
                // Get creator's user_id
                const creator = await pool.query('SELECT user_id FROM users WHERE id = $1', [creatorId]);
                if (creator.rows.length === 0) {
                    console.log(`⚠️  Skipping ${resourceName} - creator not found (id: ${creatorId})`);
                    continue;
                }
                const creatorUserId = creator.rows[0].user_id;
                // Create owner tuple in OpenFGA
                const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        writes: {
                            tuple_keys: [{
                                    user: creatorUserId,
                                    relation: 'owner',
                                    object: `resource:${resourceName}`
                                }]
                        }
                    })
                });
                if (response.ok) {
                    console.log(`✅ Migrated: ${resourceName} → owner: ${creatorUserId}`);
                }
                else {
                    const error = await response.text();
                    console.error(`❌ Failed to migrate ${resourceName}:`, error);
                }
            }
            catch (itemError) {
                console.error(`❌ Error processing item ${resource.id}:`, itemError.message);
            }
        }
        console.log('✅ Migration process complete!');
    }
    catch (error) {
        console.error('❌ Migration script failed:', error.message);
    }
    finally {
        await pool.end();
    }
}
migrateToIndividualTuples();
