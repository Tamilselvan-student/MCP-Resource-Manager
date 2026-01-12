import dotenv from 'dotenv';
import { MCPHandler, MCPRequest } from './mcp-handler.js';

dotenv.config();

const handler = new MCPHandler();

// ============================================
// TEST SCENARIOS
// ============================================

async function runTests() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 MCP Handler Tests');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let passedTests = 0;
    let failedTests = 0;

    // ============================================
    // TEST AS THARSAN (Owner)
    // ============================================

    console.log('Testing as: user:tharsan (Owner)');
    console.log('─────────────────────────────────');

    // Test 1: List files (should succeed)
    try {
        const request: MCPRequest = {
            action: 'list',
            resourceType: 'file',
            userId: 'user:tharsan'
        };
        const response = await handler.handle(request);
        
        if (response.success && response.data && response.data.length >= 2) {
            console.log(`✅ Test 1 PASSED: List files (found ${response.data.length} files)`);
            passedTests++;
        } else {
            console.log('❌ Test 1 FAILED: List files');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 1 FAILED:', error);
        failedTests++;
    }

    // Test 2: List appointments (should succeed)
    try {
        const request: MCPRequest = {
            action: 'list',
            resourceType: 'appointment',
            userId: 'user:tharsan'
        };
        const response = await handler.handle(request);
        
        if (response.success && response.data && response.data.length >= 1) {
            console.log(`✅ Test 2 PASSED: List appointments (found ${response.data.length})`);
            passedTests++;
        } else {
            console.log('❌ Test 2 FAILED: List appointments');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 2 FAILED:', error);
        failedTests++;
    }

    // Test 3: List projects (should succeed)
    try {
        const request: MCPRequest = {
            action: 'list',
            resourceType: 'project',
            userId: 'user:tharsan'
        };
        const response = await handler.handle(request);
        
        if (response.success) {
            console.log(`✅ Test 3 PASSED: List projects (found ${response.data?.length || 0})`);
            passedTests++;
        } else {
            console.log('❌ Test 3 FAILED: List projects');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 3 FAILED:', error);
        failedTests++;
    }

    // Test 4: Create file (should succeed)
    try {
        const request: MCPRequest = {
            action: 'create',
            resourceType: 'file',
            userId: 'user:tharsan',
            data: { name: 'test-document.pdf', size: 1024 }
        };
        const response = await handler.handle(request);
        
        if (response.success && response.data) {
            console.log(`✅ Test 4 PASSED: Create file (ID: ${response.data.id})`);
            passedTests++;
            
            // Store ID for delete test
            (global as any).testFileId = response.data.id;
        } else {
            console.log('❌ Test 4 FAILED: Create file');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 4 FAILED:', error);
        failedTests++;
    }

    // Test 5: Delete file (should succeed)
    if ((global as any).testFileId) {
        try {
            const request: MCPRequest = {
                action: 'delete',
                resourceType: 'file',
                userId: 'user:tharsan',
                resourceId: (global as any).testFileId
            };
            const response = await handler.handle(request);
            
            if (response.success) {
                console.log('✅ Test 5 PASSED: Delete file');
                passedTests++;
            } else {
                console.log('❌ Test 5 FAILED: Delete file');
                failedTests++;
            }
        } catch (error) {
            console.log('❌ Test 5 FAILED:', error);
            failedTests++;
        }
    }

    console.log('');

    // ============================================
    // TEST AS SARAH (Viewer)
    // ============================================

    console.log('Testing as: user:sarah (Viewer)');
    console.log('─────────────────────────────────');

    // Test 6: List files (should succeed)
    try {
        const request: MCPRequest = {
            action: 'list',
            resourceType: 'file',
            userId: 'user:sarah'
        };
        const response = await handler.handle(request);
        
        if (response.success && response.data) {
            console.log(`✅ Test 6 PASSED: List files as Sarah (found ${response.data.length})`);
            passedTests++;
        } else {
            console.log('❌ Test 6 FAILED: List files as Sarah');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 6 FAILED:', error);
        failedTests++;
    }

    // Test 7: List appointments (should FAIL - no permission)
    try {
        const request: MCPRequest = {
            action: 'list',
            resourceType: 'appointment',
            userId: 'user:sarah'
        };
        const response = await handler.handle(request);
        
        if (!response.success && response.error) {
            console.log('✅ Test 7 PASSED: List appointments denied (EXPECTED)');
            passedTests++;
        } else {
            console.log('❌ Test 7 FAILED: Should have denied appointment access');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 7 FAILED:', error);
        failedTests++;
    }

    // Test 8: List projects (should succeed)
    try {
        const request: MCPRequest = {
            action: 'list',
            resourceType: 'project',
            userId: 'user:sarah'
        };
        const response = await handler.handle(request);
        
        if (response.success) {
            console.log(`✅ Test 8 PASSED: List projects as Sarah`);
            passedTests++;
        } else {
            console.log('❌ Test 8 FAILED: List projects as Sarah');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 8 FAILED:', error);
        failedTests++;
    }

    // Test 9: Create file (should FAIL - viewer can't create)
    try {
        const request: MCPRequest = {
            action: 'create',
            resourceType: 'file',
            userId: 'user:sarah',
            data: { name: 'unauthorized.pdf' }
        };
        const response = await handler.handle(request);
        
        if (!response.success && response.error) {
            console.log('✅ Test 9 PASSED: Create file denied (EXPECTED)');
            passedTests++;
        } else {
            console.log('❌ Test 9 FAILED: Should have denied file creation');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 9 FAILED:', error);
        failedTests++;
    }

    // Test 10: Delete file (should FAIL - viewer can't delete)
    try {
        const request: MCPRequest = {
            action: 'delete',
            resourceType: 'file',
            userId: 'user:sarah',
            resourceId: 'any-id'
        };
        const response = await handler.handle(request);
        
        if (!response.success && response.error) {
            console.log('✅ Test 10 PASSED: Delete file denied (EXPECTED)');
            passedTests++;
        } else {
            console.log('❌ Test 10 FAILED: Should have denied file deletion');
            failedTests++;
        }
    } catch (error) {
        console.log('❌ Test 10 FAILED:', error);
        failedTests++;
    }

    // ============================================
    // RESULTS
    // ============================================

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Total:  ${passedTests + failedTests}`);
    
    if (failedTests === 0) {
        console.log('\n🎉 ALL TESTS PASSED! 🎉');
    } else {
        console.log(`\n⚠️  ${failedTests} test(s) failed`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Cleanup
    await handler.close();
    process.exit(failedTests === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});