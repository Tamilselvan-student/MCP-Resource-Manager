import pool from './database.js';
import dotenv from 'dotenv';
dotenv.config();
async function fixExistingUsers() {
    console.log('🔧 Adding existing viewers and editors to OpenFGA groups...\n');
    try {
        // Get all viewers and editors
        const result = await pool.query(`
            SELECT uuid, username, email, role 
            FROM users 
            WHERE role IN ('viewer', 'editor')
            ORDER BY role, username
        `);
        const users = result.rows;
        console.log(`Found ${users.length} users to process:\n`);
        let successCount = 0;
        let errorCount = 0;
        for (const user of users) {
            const groupName = `group:${user.role}s`;
            const userFgaId = `user:${user.uuid}`;
            console.log(`Processing: ${user.username} (${user.role})`);
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
                    // Ignore duplicate errors (user already in group)
                    if (errorText.includes('duplicate') || errorText.includes('already exists')) {
                        console.log(`  ℹ️  Already in group (skipping)`);
                        successCount++;
                    }
                    else {
                        console.error(`  ❌ Failed:`, errorText);
                        errorCount++;
                    }
                }
                else {
                    console.log(`  ✅ Added to ${groupName}`);
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
fixExistingUsers();
