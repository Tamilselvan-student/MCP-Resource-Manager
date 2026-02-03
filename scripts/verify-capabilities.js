import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const baseUrl = 'http://localhost:3002';

async function verify() {
    try {
        console.log('=== STEP 14 VERIFICATION ===\n');

        // 1. Login as admin (who should have editor permissions)
        console.log('1. Logging in as admin@test.com...');
        const loginRes = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' })
        });
        const { token } = await loginRes.json();
        console.log('   Token received:', token ? 'YES' : 'NO');

        // 2. Fetch resources and check capabilities
        console.log('\n2. Fetching resources with capabilities...');
        const resourcesRes = await fetch(`${baseUrl}/resources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resourcesData = await resourcesRes.json();

        console.log('   Status:', resourcesRes.status);
        console.log('   Resources count:', resourcesData.count);

        if (resourcesData.data && resourcesData.data.length > 0) {
            console.log('\n3. Checking capabilities for each resource:');
            resourcesData.data.forEach((resource, index) => {
                console.log(`\n   Resource ${index + 1}:`);
                console.log('     UUID:', resource.uuid);
                console.log('     Category:', resource.category);
                console.log('     Capabilities:', JSON.stringify(resource.capabilities));
                console.log('     Has can_view:', resource.capabilities?.can_view === true ? 'YES' : 'NO');
                console.log('     Has can_edit:', resource.capabilities?.can_edit === true ? 'YES' : 'NO');
            });

            // Check if at least one resource has capabilities
            const hasCapabilities = resourcesData.data.some(r => r.capabilities);
            const hasCanView = resourcesData.data.some(r => r.capabilities?.can_view);
            const hasCanEdit = resourcesData.data.some(r => r.capabilities?.can_edit);

            console.log('\n4. Summary:');
            console.log('   ✅ Resources have capabilities field:', hasCapabilities ? 'YES' : 'NO');
            console.log('   ✅ At least one resource has can_view:', hasCanView ? 'YES' : 'NO');
            console.log('   ✅ At least one resource has can_edit:', hasCanEdit ? 'YES' : 'NO');

            if (hasCapabilities && hasCanView) {
                console.log('\n✅ VERIFICATION PASSED');
                console.log('   Backend is returning UI capabilities correctly!');
            } else {
                console.log('\n❌ VERIFICATION FAILED');
                console.log('   Capabilities are not being returned correctly');
            }
        } else {
            console.log('\n⚠️  No resources found to verify');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

verify();
