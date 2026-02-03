import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mcp_resources',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

const baseUrl = 'http://localhost:3002';

async function verify() {
    try {
        // Clear existing audit logs
        await pool.query('DELETE FROM audit_logs');
        console.log('✅ Cleared existing audit logs');

        // 1. Login to get token
        console.log('\n1. Logging in...');
        const loginRes = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' })
        });
        const { token } = await loginRes.json();
        console.log('   Token received:', token ? 'YES' : 'NO');

        // 2. Test successful read
        console.log('\n2. Testing successful read (GET /resources)...');
        const readRes = await fetch(`${baseUrl}/resources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('   Status:', readRes.status);

        // 3. Check audit log for read
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for async logging
        const readAudit = await pool.query(`
            SELECT * FROM audit_logs 
            WHERE action = 'read' 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        console.log('   Audit log created:', readAudit.rows.length > 0 ? 'YES' : 'NO');
        if (readAudit.rows.length > 0) {
            console.log('   User UUID:', readAudit.rows[0].user_uuid);
            console.log('   Action:', readAudit.rows[0].action);
        }

        // 4. Test failed read (no token) - should NOT create audit log
        console.log('\n3. Testing failed read (no token)...');
        const failedReadRes = await fetch(`${baseUrl}/resources`);
        console.log('   Status:', failedReadRes.status, '(should be 401)');

        // 5. Check that no new audit log was created
        const auditCount = await pool.query('SELECT COUNT(*) FROM audit_logs');
        console.log('   Total audit logs:', auditCount.rows[0].count, '(should be 1)');

        // 6. Test successful write (if we have a resource)
        console.log('\n4. Testing successful write (POST /resources/:uuid)...');
        const resourcesRes = await fetch(`${baseUrl}/resources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resourcesData = await resourcesRes.json();

        if (resourcesData.data && resourcesData.data.length > 0) {
            const resourceUuid = resourcesData.data[0].uuid;
            console.log('   Using resource UUID:', resourceUuid);

            const writeRes = await fetch(`${baseUrl}/resources/${resourceUuid}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ test: 'data' })
            });
            console.log('   Status:', writeRes.status);

            // Check audit log for write
            await new Promise(resolve => setTimeout(resolve, 500));
            const writeAudit = await pool.query(`
                SELECT * FROM audit_logs 
                WHERE action = 'write' AND resource_uuid = $1
                ORDER BY created_at DESC 
                LIMIT 1
            `, [resourceUuid]);
            console.log('   Audit log created:', writeAudit.rows.length > 0 ? 'YES' : 'NO');
            if (writeAudit.rows.length > 0) {
                console.log('   Resource UUID:', writeAudit.rows[0].resource_uuid);
                console.log('   Action:', writeAudit.rows[0].action);
            }
        } else {
            console.log('   No resources available for write test');
        }

        // Final summary
        const finalCount = await pool.query('SELECT COUNT(*) FROM audit_logs');
        console.log('\n✅ Final audit log count:', finalCount.rows[0].count);
        console.log('✅ VERIFICATION COMPLETE');

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        await pool.end();
    }
}

verify();
