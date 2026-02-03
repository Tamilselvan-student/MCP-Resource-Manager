import { OpenFgaClient } from '@openfga/sdk';
import { Pool } from 'pg';
// ============================================
// MCP HANDLER - Core Business Logic
// ============================================
export class MCPHandler {
    constructor() {
        this.storeId = process.env.FGA_STORE_ID || '';
        this.modelId = process.env.FGA_MODEL_ID || '';
        if (!this.storeId || !this.modelId) {
            console.error('❌ ERROR: FGA_STORE_ID and FGA_MODEL_ID must be set in .env');
            throw new Error('Missing OpenFGA configuration');
        }
        // Initialize OpenFGA Client with store and model IDs
        this.fgaClient = new OpenFgaClient({
            apiUrl: process.env.FGA_API_URL || 'http://localhost:8080',
            storeId: this.storeId,
            authorizationModelId: this.modelId,
        });
        // Initialize PostgreSQL Pool
        this.dbPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'mcp_resources',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
        });
        console.log('✅ MCP Handler initialized');
        console.log(`   OpenFGA Store: ${this.storeId}`);
        console.log(`   OpenFGA Model: ${this.modelId}`);
    }
    // ============================================
    // MAIN HANDLER - Routes requests
    // ============================================
    async handle(request) {
        console.log(`\n🔄 Processing request:`, JSON.stringify(request, null, 2));
        try {
            // Validate request
            if (!request.action || !request.resourceType || !request.userId) {
                return {
                    success: false,
                    error: 'Missing required fields: action, resourceType, or userId'
                };
            }
            // Route to appropriate handler based on action
            switch (request.action) {
                case 'list':
                    return await this.handleList(request);
                case 'read':
                    return await this.handleRead(request);
                case 'create':
                    return await this.handleCreate(request);
                case 'update':
                    return await this.handleUpdate(request);
                case 'delete':
                    return await this.handleDelete(request);
                default:
                    return {
                        success: false,
                        error: `Unknown action: ${request.action}`
                    };
            }
        }
        catch (error) {
            console.error('❌ Error handling request:', error);
            return {
                success: false,
                error: error.message || 'Internal server error'
            };
        }
    }
    // ============================================
    // LIST - Get all resources of a type
    // ============================================
    async handleList(request) {
        const { resourceType, userId, filters } = request;
        console.log(`📋 Listing ${resourceType} for ${userId}`);
        // Check permission
        const hasPermission = await this.checkPermission(userId, `resource:${resourceType}_*`, 'can_list');
        if (!hasPermission) {
            console.log(`❌ Permission denied for ${userId} to list ${resourceType}`);
            return {
                success: false,
                error: `Access denied: You don't have permission to view ${resourceType}`,
                message: `You need viewer, editor, or owner access to view ${resourceType}.`
            };
        }
        // Build query with optional filters
        let query = 'SELECT * FROM resources WHERE resource_type = $1';
        const params = [resourceType];
        if (filters) {
            // Add dynamic filters (e.g., created_by, date ranges, file_type)
            if (filters.created_by) {
                query += ` AND created_by = $${params.length + 1}`;
                params.push(filters.created_by);
            }
            // Filter by file type (for files only)
            if (filters.file_type && resourceType === 'file') {
                query += ` AND (data->>'name' LIKE $${params.length + 1} OR data->>'mime_type' LIKE $${params.length + 1})`;
                params.push(`%.${filters.file_type}%`);
            }
            // Filter by exact name
            if (filters.name) {
                query += ` AND data->>'name' = $${params.length + 1}`;
                params.push(filters.name);
            }
            // Can add more filter logic here
        }
        query += ' ORDER BY created_at DESC';
        try {
            const result = await this.dbPool.query(query, params);
            console.log(`✅ Found ${result.rows.length} ${resourceType}(s) in database`);
            // Filter by permission - check each resource individually
            const accessibleResources = [];
            for (const resource of result.rows) {
                const hasAccess = await this.checkResourcePermission(userId, resourceType, resource.id, 'viewer');
                if (hasAccess) {
                    accessibleResources.push(resource);
                }
            }
            console.log(`✅ User has access to ${accessibleResources.length} ${resourceType}(s)`);
            return {
                success: true,
                data: accessibleResources,
                message: `Found ${accessibleResources.length} ${resourceType}(s)`
            };
        }
        catch (error) {
            console.error(`❌ Database error:`, error);
            return {
                success: false,
                error: `Database error: ${error.message}`
            };
        }
    }
    // ============================================
    // READ - Get a specific resource
    // ============================================
    async handleRead(request) {
        const { resourceType, resourceId, userId } = request;
        if (!resourceId) {
            return {
                success: false,
                error: 'Resource ID is required for read operation'
            };
        }
        console.log(`📖 Reading ${resourceType}:${resourceId} for ${userId}`);
        // Check permission - specific resource first, then wildcard
        const hasPermission = await this.checkResourcePermission(userId, resourceType, resourceId, 'viewer');
        if (!hasPermission) {
            return {
                success: false,
                error: 'Access denied: You don\'t have permission to view this resource'
            };
        }
        try {
            const result = await this.dbPool.query('SELECT * FROM resources WHERE id = $1 AND resource_type = $2', [resourceId, resourceType]);
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: `${resourceType} with ID ${resourceId} not found`
                };
            }
            console.log(`✅ Resource found`);
            return {
                success: true,
                data: result.rows[0]
            };
        }
        catch (error) {
            console.error(`❌ Database error:`, error);
            return {
                success: false,
                error: `Database error: ${error.message}`
            };
        }
    }
    // ============================================
    // CREATE - Create a new resource
    // ============================================
    async handleCreate(request) {
        const { resourceType, data, userId } = request;
        if (!data) {
            return {
                success: false,
                error: 'Data is required for create operation'
            };
        }
        console.log(`➕ Creating ${resourceType} for ${userId}`);
        // Check permission - only admins/owners can create
        const hasPermission = await this.checkPermission(userId, `resource:${resourceType}_*`, 'can_delete');
        if (!hasPermission) {
            return {
                success: false,
                error: 'Access denied: You don\'t have permission to create resources',
                message: 'Only admins can create resources.'
            };
        }
        try {
            const result = await this.dbPool.query('INSERT INTO resources (resource_type, data, created_by) VALUES ($1, $2, $3) RETURNING *', [resourceType, JSON.stringify(data), userId]);
            const resourceId = result.rows[0].id;
            console.log(`✅ Created ${resourceType} with ID: ${resourceId}`);
            // Create resource-specific OpenFGA tuple (only creator has access)
            try {
                const tupleBody = {
                    writes: {
                        tuple_keys: [{
                                user: userId,
                                relation: 'owner',
                                object: `resource:${resourceType}_${resourceId}`
                            }]
                    }
                };
                const fgaResponse = await fetch(`${process.env.FGA_API_URL}/stores/${this.storeId}/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tupleBody)
                });
                if (fgaResponse.ok) {
                    console.log(`✅ Created OpenFGA permission for ${resourceType}_${resourceId}`);
                }
                else {
                    console.warn(`⚠️  Failed to create OpenFGA permission, but resource was created`);
                }
            }
            catch (fgaError) {
                console.warn(`⚠️  OpenFGA error (resource still created):`, fgaError.message);
            }
            return {
                success: true,
                data: result.rows[0],
                message: `${resourceType} created successfully`
            };
        }
        catch (error) {
            console.error(`❌ Database error:`, error);
            return {
                success: false,
                error: `Database error: ${error.message}`
            };
        }
    }
    // ============================================
    // UPDATE - Update an existing resource
    // ============================================
    async handleUpdate(request) {
        const { resourceType, resourceId, data, userId } = request;
        if (!resourceId || !data) {
            return {
                success: false,
                error: 'Resource ID and data are required for update operation'
            };
        }
        console.log(`✏️ Updating ${resourceType}:${resourceId} for ${userId}`);
        // Check permission - specific resource first, then wildcard
        const hasPermission = await this.checkResourcePermission(userId, resourceType, resourceId, 'can_edit');
        if (!hasPermission) {
            return {
                success: false,
                error: 'Access denied: You don\'t have permission to edit resources'
            };
        }
        try {
            const result = await this.dbPool.query('UPDATE resources SET data = $1, updated_at = NOW() WHERE id = $2 AND resource_type = $3 RETURNING *', [JSON.stringify(data), resourceId, resourceType]);
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: `${resourceType} with ID ${resourceId} not found`
                };
            }
            console.log(`✅ Updated ${resourceType}`);
            return {
                success: true,
                data: result.rows[0],
                message: `${resourceType} updated successfully`
            };
        }
        catch (error) {
            console.error(`❌ Database error:`, error);
            return {
                success: false,
                error: `Database error: ${error.message}`
            };
        }
    }
    // ============================================
    // DELETE - Delete a resource
    // ============================================
    async handleDelete(request) {
        const { resourceType, resourceId, userId } = request;
        if (!resourceId) {
            return {
                success: false,
                error: 'Resource ID is required for delete operation'
            };
        }
        console.log(`🗑️ Deleting ${resourceType}:${resourceId} for ${userId}`);
        // Check permission - specific resource first, then wildcard
        const hasPermission = await this.checkResourcePermission(userId, resourceType, resourceId, 'can_delete');
        if (!hasPermission) {
            return {
                success: false,
                error: 'Access denied: You don\'t have permission to delete resources',
                message: 'Only owners can delete resources.'
            };
        }
        try {
            const result = await this.dbPool.query('DELETE FROM resources WHERE id = $1 AND resource_type = $2 RETURNING *', [resourceId, resourceType]);
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: `${resourceType} with ID ${resourceId} not found`
                };
            }
            console.log(`✅ Deleted ${resourceType}`);
            return {
                success: true,
                message: `${resourceType} deleted successfully`
            };
        }
        catch (error) {
            console.error(`❌ Database error:`, error);
            return {
                success: false,
                error: `Database error: ${error.message}`
            };
        }
    }
    // ============================================
    // PERMISSION CHECK - OpenFGA Integration
    // ============================================
    async checkPermission(userId, resourceObject, relation) {
        console.log(`🔐 Checking permission: ${userId} -> ${relation} -> ${resourceObject}`);
        try {
            const { allowed } = await this.fgaClient.check({
                user: userId,
                relation: relation,
                object: resourceObject
            });
            console.log(`   Permission result: ${allowed ? '✅ ALLOWED' : '❌ DENIED'}`);
            return allowed || false;
        }
        catch (error) {
            console.error(`❌ OpenFGA error:`, error);
            // Fail closed - deny access on error
            return false;
        }
    }
    // Check permission for specific resource with wildcard fallback
    async checkResourcePermission(userId, resourceType, resourceId, relation) {
        // First check specific resource permission
        // Protocol Format: resource:uuid
        const specificPermission = await this.checkPermission(userId, `resource:${resourceId}`, relation);
        return specificPermission;
    }
    // Batch check resources for a single user and relation
    // Returns array of boolean results matching the input order
    async batchCheck(checks) {
        console.log(`🔐 Batch checking ${checks.length} permissions...`);
        // Since the JS SDK might not have a dedicated batch check covering distinct resources widely,
        // we use Promise.all to execute them in parallel.
        const promises = checks.map(check => {
            // Ensure userId is properly formatted as 'user:UUID'
            const formattedUserId = check.userId.startsWith('user:')
                ? check.userId
                : `user:${check.userId}`;
            return this.checkPermission(formattedUserId, check.object, check.relation);
        });
        return Promise.all(promises);
    }
    // ============================================
    // CLEANUP
    // ============================================
    async close() {
        await this.dbPool.end();
        console.log('✅ MCP Handler closed');
    }
}
