
import pg from 'pg';
import fetch from 'node-fetch';
import fs from 'fs';

const { Pool } = pg;
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mcp_resources',
    password: 'password',
    port: 5432,
});

const STORE_ID = '01KEPX4H744E7RA0WNQDS6DWA7';
const API_URL = 'http://localhost:8080';

async function checkHealth() {
    let report = '';

    try {
        console.log('--- AUDIT STARTED ---');
        report += '--- AUDIT REPORT ---\n';

        // 1. Get All Users
        const users = await pool.query("SELECT uuid, username, role FROM users");
        report += `Database Users: ${users.rows.length}\n`;

        // 2. Get All Resources
        const resources = await pool.query("SELECT uuid, data->>'name' as name, created_by, visible_to_viewer, visible_to_editor FROM resources");
        report += `Database Resources: ${resources.rows.length}\n\n`;

        // 3. Check User Group Membership
        report += '--- MISSING GROUP MEMBERSHIPS ---\n';
        for (const user of users.rows) {
            if (user.role === 'viewer' || user.role === 'editor') {
                const groupName = `${user.role}s`;
                const checkBody = {
                    tuple_key: {
                        user: `user:${user.uuid}`,
                        relation: 'member',
                        object: `group:${groupName}`
                    }
                };

                try {
                    const res = await fetch(`${API_URL}/stores/${STORE_ID}/check`, {
                        method: 'POST',
                        body: JSON.stringify(checkBody),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await res.json();
                    if (!data.allowed) {
                        const line = `MISSING: User ${user.username} (${user.role}) NOT in group:${groupName}`;
                        console.log(line);
                        report += line + '\n';
                    }
                } catch (e) {
                    report += `ERROR checking user ${user.username}: ${e.message}\n`;
                }
            }
        }

        // 4. Check Resource Owner Tuples
        report += '\n--- MISSING RESOURCE OWNERS ---\n';
        for (const res of resources.rows) {
            // Check Owner
            const checkOwner = {
                tuple_key: {
                    user: `user:${res.created_by}`,
                    relation: 'owner',
                    object: `resource:${res.uuid}`
                }
            };
            const ownerRes = await fetch(`${API_URL}/stores/${STORE_ID}/check`, {
                method: 'POST',
                body: JSON.stringify(checkOwner),
                headers: { 'Content-Type': 'application/json' }
            });
            const ownerData = await ownerRes.json();

            if (!ownerData.allowed) {
                const line = `MISSING: Resource ${res.name} missing OWNER tuple for ${res.created_by}`;
                console.log(line);
                report += line + '\n';
            }

            // Check Visibility groups (Sampling check - direct check would be better but this is audit)
            if (res.visible_to_viewer) {
                const checkViewer = {
                    tuple_key: {
                        user: 'group:viewers#member',
                        relation: 'viewer',
                        object: `resource:${res.uuid}`
                    }
                };
                // For group sets, we can't use 'check' easily if we are checking the group binding itself unless we treat group#member as user.
                // Actually FGA `check` works for `user: 'group:viewers#member'`.
                const vRes = await fetch(`${API_URL}/stores/${STORE_ID}/check`, {
                    method: 'POST',
                    body: JSON.stringify(checkViewer),
                    headers: { 'Content-Type': 'application/json' }
                });
                const vData = await vRes.json();
                if (!vData.allowed) {
                    const line = `MISSING: Resource ${res.name} missing VIEWER GROUP tuple`;
                    console.log(line);
                    report += line + '\n';
                }
            }
        }

        fs.writeFileSync('audit_report.txt', report);
        console.log('--- AUDIT COMPLETE ---');
        console.log('Report saved to audit_report.txt');

    } catch (e) {
        console.error('Audit failed:', e);
    } finally {
        await pool.end();
    }
}

checkHealth();
