import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

const FGA_API_URL = process.env.FGA_API_URL;
const FGA_STORE_ID = process.env.FGA_STORE_ID;

const VALID_CATEGORIES = ['project', 'customer', 'expense']; // Random selection

async function createFgaTuple(user, relation, object) {
    try {
        const response = await fetch(`${FGA_API_URL}/stores/${FGA_STORE_ID}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                writes: {
                    tuple_keys: [{ user, relation, object }]
                }
            })
        });
        if (!response.ok) {
            console.error(`❌ FGA User ${user} -> ${relation} ${object} FAILED:`, await response.text());
        } else {
            console.log(`✅ FGA User ${user} -> ${relation} ${object}`);
        }
    } catch (e) {
        console.error('FGA Error:', e.message);
    }
}

async function run() {
    try {
        console.log('🚀 Starting scenario creation...');

        // 1. Create Viewer User
        const email = 'viewer_test@example.com';
        const passwordHash = await bcrypt.hash('password123', 10);
        let viewerUuid;

        const userRes = await pool.query(`
            INSERT INTO users (username, email, password_hash, role, must_change_password, is_active, created_at, updated_at)
            VALUES ('viewer_test', $1, $2, 'viewer', false, true, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET role = 'viewer'
            RETURNING uuid
        `, [email, passwordHash]);

        viewerUuid = userRes.rows[0].uuid;
        console.log(`✅ User 'viewer_test' (${viewerUuid}) ready.`);

        // 2. Prepare Resources
        const resources = [];
        for (let i = 0; i < 3; i++) {
            const category = VALID_CATEGORIES[i % VALID_CATEGORIES.length];
            const name = `Scenario_File_${i + 1}_${category}.txt`;

            console.log(`Debug Insert: Category=${category}, UUID=${viewerUuid}`);

            const res = await pool.query(`
                INSERT INTO resources (
                    resource_type, 
                    category,
                    data, 
                    visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer,
                    created_by, created_at, updated_at
                )
                VALUES ($1, $2, $3, true, true, true, true, $4, NOW(), NOW())
                RETURNING uuid, data
            `, [
                category,
                category,
                JSON.stringify({ name, category }),
                viewerUuid // Created by viewer for simplicity, permissions handled separately
            ]);

            resources.push({
                id: res.rows[0].uuid,
                name: res.rows[0].data.name
            });
            console.log(`✅ Resource '${name}' (ID: ${res.rows[0].uuid}) created.`);
        }

        // 3. Grant Permissions
        // Get all users
        const users = await pool.query('SELECT uuid, role FROM users');
        const admins = users.rows.filter(u => u.role === 'admin' || u.role === 'owner');
        const editors = users.rows.filter(u => u.role === 'editor');
        const viewers = users.rows.filter(u => u.role === 'viewer');

        console.log(`Found ${admins.length} admins, ${editors.length} editors, ${viewers.length} viewers.`);

        for (const res of resources) {
            const object = `resource:${res.id}`;

            // Grant Admins -> Owner
            for (const u of admins) {
                await createFgaTuple(`user:${u.uuid}`, 'owner', object);
            }
            // Grant Editors -> Editor
            for (const u of editors) {
                // Note: Editor role in FGA is 'editor'.
                await createFgaTuple(`user:${u.uuid}`, 'editor', object);
            }
            // Grant Viewers -> Viewer
            for (const u of viewers) {
                await createFgaTuple(`user:${u.uuid}`, 'viewer', object);
            }
        }

        console.log('✨ Scenario creation complete!');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
