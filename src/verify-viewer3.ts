import pool from './database.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyUserInGroup() {
    console.log('🔍 Verifying user group membership...\n');

    try {
        // Get viewer3's info from database
        const userResult = await pool.query(`
            SELECT uuid, username, email, role
            FROM users
            WHERE email = 'viewer3@example.com'
        `);

        if (userResult.rows.length === 0) {
            console.log('❌ User viewer3@example.com not found in database');
            return;
        }

        const user = userResult.rows[0];
        console.log('User from database:');
        console.log(`  UUID: ${user.uuid}`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);

        // Check if user is in OpenFGA group
        const userFgaId = `user:${user.uuid}`;
        const groupName = `group:${user.role}s`;

        console.log(`\nChecking OpenFGA: ${userFgaId} member ${groupName}...`);

        const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tuple_key: {
                    user: userFgaId,
                    relation: 'member',
                    object: groupName
                }
            })
        });

        const data = await response.json();
        console.log('\nOpenFGA Response:');
        console.log(JSON.stringify(data, null, 2));

        if (data.tuples && data.tuples.length > 0) {
            console.log('\n✅ User IS in the group!');
        } else {
            console.log('\n❌ User is NOT in the group!');
            console.log('\nAttempting to add user to group...');

            const writeResponse = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
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

            if (!writeResponse.ok) {
                console.error('❌ Failed to add user to group:', await writeResponse.text());
            } else {
                console.log('✅ Successfully added user to group!');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

verifyUserInGroup();
