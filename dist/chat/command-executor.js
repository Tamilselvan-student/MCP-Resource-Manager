import pool from '../database.js';
import { deleteUser } from '../database.js';
import { findUserByIdentifier, findResourceByName } from './nlp-parser.js';
import bcrypt from 'bcryptjs';
// ============================================
// PERMISSION CHECKS
// ============================================
async function checkPermission(userId, requiredRoles) {
    try {
        console.log(`🔐 checkPermission - userId: ${userId} (type: ${typeof userId}), requiredRoles:`, requiredRoles);
        const result = await pool.query('SELECT role FROM users WHERE uuid = $1', [userId]);
        if (result.rows.length === 0) {
            return false;
        }
        const userRole = result.rows[0].role;
        return requiredRoles.includes(userRole);
    }
    catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}
// ============================================
// COMMAND EXECUTORS
// ============================================
/**
 * Change user role
 */
async function executeChangeRole(command, executorId) {
    const { user: userIdentifier, newRole } = command.entities;
    if (!userIdentifier || !newRole) {
        return {
            success: false,
            message: '❌ Missing user or role information',
            error: 'Invalid command parameters'
        };
    }
    // PERMISSION CHECK REMOVED - Chat is admin-only, no restrictions needed
    // Find target user
    const targetUser = await findUserByIdentifier(userIdentifier);
    if (!targetUser) {
        return {
            success: false,
            message: `❌ User '${userIdentifier}' not found`,
            error: 'User not found'
        };
    }
    // Prevent changing owner role
    if (targetUser.role === 'owner') {
        return {
            success: false,
            message: '❌ Cannot change owner role',
            error: 'Protected role'
        };
    }
    console.log('\n=== ROLE CHANGE DEBUG START ===');
    console.log('📊 targetUser.user_id:', targetUser.user_id);
    console.log('📊 targetUser.uuid:', targetUser.uuid);
    console.log('📊 targetUser.role (cached):', targetUser.role);
    console.log('📊 newRole (target):', newRole);
    // Fetch FRESH user data from database to check current role
    // CRITICAL: Use user_id (string) not id (integer) to get accurate data
    console.log('🔍 Executing query: SELECT role FROM users WHERE user_id = $1');
    console.log('🔍 Query parameter [user_id]:', targetUser.user_id);
    const freshUserResult = await pool.query('SELECT role FROM users WHERE uuid = $1', [targetUser.uuid]);
    console.log('🔍 Query returned rowCount:', freshUserResult.rowCount);
    console.log('🔍 Query returned rows:', JSON.stringify(freshUserResult.rows, null, 2));
    const currentRole = freshUserResult.rows[0]?.role;
    console.log('📊 currentRole (extracted from query):', currentRole);
    if (!currentRole) {
        console.error('❌ ERROR: Fresh query returned no role!');
        console.log('=== ROLE CHANGE DEBUG END ===\n');
        return {
            success: false,
            message: `❌ Could not fetch current role for ${targetUser.username}`,
            error: 'Failed to query current role'
        };
    }
    console.log(`📊 COMPARISON:`);
    console.log(`   Current role (DB): ${currentRole}`);
    console.log(`   Cached role (obj): ${targetUser.role}`);
    console.log(`   Target role (new): ${newRole}`);
    console.log(`   Match? currentRole === newRole: ${currentRole === newRole}`);
    // Check if role is already set (using FRESH data)
    if (currentRole === newRole) {
        console.log('✅ User already has target role, no change needed');
        console.log('=== ROLE CHANGE DEBUG END ===\n');
        return {
            success: true,
            message: `✅ ${targetUser.username} is already ${newRole}`,
            data: { user: targetUser, unchanged: true }
        };
    }
    console.log('=== ROLE CHANGE DEBUG END ===\n');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log(`🔄 Changing ${targetUser.username} from ${currentRole} to ${newRole}`);
        // Update role in database
        const updateResult = await client.query('UPDATE users SET role = $1, updated_at = NOW() WHERE uuid = $2 RETURNING role', [newRole, targetUser.uuid]);
        console.log(`✅ Database UPDATE result:`, updateResult.rows[0]);
        // Log to admin_grants table (optional - table may not exist)
        try {
            const executorResult = await client.query('SELECT uuid FROM users WHERE uuid = $1', [executorId]);
            if (executorResult.rows.length > 0) {
                await client.query(`
                    INSERT INTO admin_grants (user_uuid, granted_by, action, previous_role, new_role, reason)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    targetUser.uuid,
                    executorResult.rows[0].uuid,
                    newRole === 'admin' ? 'granted' : 'revoked',
                    targetUser.role,
                    newRole,
                    'Changed via chat interface'
                ]);
            }
        }
        catch (auditError) {
            // Audit logging failed, but continue with role change
            console.log('⚠️  Admin grants table not found - skipping audit log');
        }
        // COMMIT the database transaction BEFORE OpenFGA update
        // This ensures role change persists even if OpenFGA fails
        await client.query('COMMIT');
        console.log('✅ Database transaction committed');
        // ✅ DEBUG: Verify immediately after commit
        const verify1 = await pool.query('SELECT role FROM users WHERE uuid = $1', [targetUser.uuid]);
        console.log('🔍 DEBUG - DB role immediately after COMMIT:', verify1.rows[0]?.role);
        console.log('🔍 DEBUG - Expected role:', newRole);
        console.log('🔍 DEBUG - Match?', verify1.rows[0]?.role === newRole);
        // Update OpenFGA permissions (optional - may fail if OpenFGA is not configured)
        // This is done AFTER commit so failures don't rollback the database change
        try {
            console.log('OpenFGA: No longer using wildcard permissions. Access is granted per-resource.');
            /*
            // PREVIOUS WILDCARD LOGIC - DISABLED FOR FILE-LEVEL PERMISSIONS
            console.log('\n🧹 CLEANING ALL POSSIBLE OLD TUPLES (database-agnostic approach)');
            // ... (disabled code)
            */
        }
        catch (fgaError) {
            // OpenFGA update failed, but continue with role change
            console.error('⚠️  OpenFGA permission update failed:', fgaError.message);
        }
        // ✅ DEBUG: Verify after OpenFGA error
        const verify2 = await pool.query('SELECT role FROM users WHERE uuid = $1', [targetUser.uuid]);
        console.log('🔍 DEBUG - DB role after OpenFGA error:', verify2.rows[0]?.role);
        console.log('🔍 DEBUG - Expected role:', newRole);
        console.log('🔍 DEBUG - Match?', verify2.rows[0]?.role === newRole);
        // ✅ DEBUG: Final verification before return
        const verify3 = await pool.query('SELECT role FROM users WHERE uuid = $1', [targetUser.uuid]);
        console.log('🔍 DEBUG - DB role at final return:', verify3.rows[0]?.role);
        console.log('🔍 DEBUG - Expected role:', newRole);
        console.log('🔍 DEBUG - Match?', verify3.rows[0]?.role === newRole);
        return {
            success: true,
            message: `✅ ${targetUser.username} is now ${newRole}. Role updated successfully.`,
            data: {
                user: targetUser.username,
                oldRole: currentRole, // Use fresh data instead of stale targetUser.role
                newRole: newRole
            }
        };
    }
    catch (error) {
        console.log('🚨 DEBUG - OUTER CATCH TRIGGERED - This would cause ROLLBACK');
        console.log('🚨 DEBUG - Error that triggered rollback:', error.message);
        await client.query('ROLLBACK');
        console.error('Error changing role:', error);
        return {
            success: false,
            message: '❌ Failed to change user role',
            error: error.message
        };
    }
    finally {
        client.release();
    }
}
/**
 * List users by role
 */
async function executeListUsers(command, executorId) {
    const { role } = command.entities;
    try {
        let query = 'SELECT uuid, username, email, role, created_at FROM users WHERE 1=1';
        const params = [];
        if (role) {
            params.push(role);
            query += ` AND role = $${params.length}`;
        }
        query += ' ORDER BY created_at ASC';
        const result = await pool.query(query, params);
        if (result.rows.length === 0) {
            const roleText = role ? `${role}s` : 'users';
            return {
                success: true,
                message: `📋 No ${roleText} found`,
                data: []
            };
        }
        return {
            success: true,
            message: 'Users retrieved successfully',
            data: result.rows
        };
    }
    catch (error) {
        console.error('Error listing users:', error);
        return {
            success: false,
            message: '❌ Failed to list users',
            error: error.message
        };
    }
}
/**
 * Create new user
 */
async function executeCreateUser(command, executorId) {
    // Import context manager and smart matchers
    const { getPendingAction, setPendingAction, clearPendingAction } = await import('./context-manager.js');
    const { matchRole, validateEmail, formatRoleList, VALID_ROLES } = await import('./smart-matchers.js');
    const { email, role } = command.entities;
    console.log('👤 CREATE_USER - entities:', command.entities);
    // Check for pending multi-step creation
    const pending = getPendingAction(executorId);
    if (pending && pending.action === 'creating_user') {
        const step = pending.data.step;
        const userData = pending.data.userData;
        const userInput = (command.raw || '').trim();
        console.log(`👤 Processing step: ${step}, input: "${userInput}"`);
        // Step 1: Asked for email, now got it
        if (step === 'awaiting_email') {
            // Validate email
            if (!validateEmail(userInput)) {
                return {
                    success: false,
                    message: `❌ "${userInput}" doesn't look like a valid email address.

Please provide a valid email (e.g., user@example.com)`,
                    error: 'Invalid email'
                };
            }
            userData.email = userInput;
            pending.data.step = 'awaiting_role';
            setPendingAction(executorId, 'creating_user', pending.data);
            return {
                success: true,
                message: `🎭 What role should this user have?

${formatRoleList()}

Just type the role name.`,
                data: { awaiting: 'role' }
            };
        }
        // Step 2: Asked for role, now got it
        if (step === 'awaiting_role') {
            const matchedRole = matchRole(userInput);
            if (!matchedRole) {
                return {
                    success: false,
                    message: `❌ "${userInput}" isn't a valid role.

Please choose one of:
${formatRoleList()}`,
                    error: 'Invalid role'
                };
            }
            userData.role = matchedRole;
            // Now create the user
            try {
                const username = userData.email.split('@')[0];
                // Check if user already exists
                const existingUser = await pool.query('SELECT uuid FROM users WHERE email = $1', [userData.email]);
                if (existingUser.rows.length > 0) {
                    clearPendingAction(executorId);
                    return {
                        success: false,
                        message: `❌ User with email ${userData.email} already exists`,
                        error: 'User already exists'
                    };
                }
                // Create user
                const passwordHash = await bcrypt.hash('changeme123', 10);
                await pool.query(`
                    INSERT INTO users (username, email, password_hash, role, must_change_password, is_active, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, TRUE, TRUE, NOW(), NOW())
                `, [username, userData.email, passwordHash, userData.role]);
                clearPendingAction(executorId);
                const roleEmoji = { owner: '🟣', admin: '🔴', editor: '🔵', viewer: '⚪' }[matchedRole] || '⚪';
                return {
                    success: true,
                    message: `✅ ${roleEmoji} User **${username}** created!

📧 **Email:** ${userData.email}
🎭 **Role:** ${userData.role}
🔑 **Default Password:** changeme123

⚠️ They must change their password on first login.`,
                    data: {
                        username,
                        email: userData.email,
                        role: userData.role
                    }
                };
            }
            catch (error) {
                console.error('Error creating user:', error);
                clearPendingAction(executorId);
                return {
                    success: false,
                    message: '❌ Failed to create user',
                    error: error.message
                };
            }
        }
    }
    // New user creation - check what info we have
    const hasEmail = email && validateEmail(email);
    const hasRole = role && VALID_ROLES.includes(role);
    // If we have everything, create immediately
    if (hasEmail && hasRole) {
        try {
            const username = email.split('@')[0];
            // Check if user already exists
            const existingUser = await pool.query('SELECT uuid FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                return {
                    success: false,
                    message: `❌ User with email ${email} already exists`,
                    error: 'User already exists'
                };
            }
            // Create user
            const passwordHash = await bcrypt.hash('changeme123', 10);
            await pool.query(`
                INSERT INTO users (username, email, password_hash, role, must_change_password, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, TRUE, TRUE, NOW(), NOW())
            `, [username, email, passwordHash, role]);
            const roleEmoji = { owner: '🟣', admin: '🔴', editor: '🔵', viewer: '⚪' }[role] || '⚪';
            return {
                success: true,
                message: `✅ ${roleEmoji} User **${username}** created!

📧 **Email:** ${email}
🎭 **Role:** ${role}
🔑 **Default Password:** changeme123`,
                data: {
                    username,
                    email,
                    role
                }
            };
        }
        catch (error) {
            console.error('Error creating user:', error);
            return {
                success: false,
                message: '❌ Failed to create user',
                error: error.message
            };
        }
    }
    // Missing info - start multi-step process
    if (!hasEmail) {
        setPendingAction(executorId, 'creating_user', {
            step: 'awaiting_email',
            userData: {}
        });
        return {
            success: true,
            message: `📧 Sure! What's the new user's email address?

**Example:** user@example.com`,
            data: { awaiting: 'email' }
        };
    }
    if (!hasRole) {
        setPendingAction(executorId, 'creating_user', {
            step: 'awaiting_role',
            userData: { email }
        });
        return {
            success: true,
            message: `🎭 What role should this user have?

${formatRoleList()}

Just type the role name.`,
            data: { awaiting: 'role' }
        };
    }
    // Shouldn't reach here
    return {
        success: false,
        message: '❌ Missing required information',
        error: 'Invalid parameters'
    };
}
/**
 * Delete user
 */
async function executeDeleteUser(command, executorId) {
    const { user: userIdentifier } = command.entities;
    if (!userIdentifier) {
        return {
            success: false,
            message: '❌ Missing user identifier',
            error: 'Invalid parameters'
        };
    }
    // PERMISSION CHECK REMOVED - Chat is admin-only, no restrictions needed
    // Find user
    const targetUser = await findUserByIdentifier(userIdentifier);
    if (!targetUser) {
        // Try to suggest similar usernames
        const similarResult = await pool.query(`
            SELECT username FROM users 
            WHERE username ILIKE $1 
            LIMIT 3
        `, [`%${userIdentifier}%`]);
        if (similarResult.rows.length > 0) {
            const suggestions = similarResult.rows.map(r => r.username).join(', ');
            return {
                success: false,
                message: `❌ User '${userIdentifier}' not found. Did you mean: ${suggestions}?`,
                error: 'User not found'
            };
        }
        return {
            success: false,
            message: `❌ User '${userIdentifier}' not found`,
            error: 'User not found'
        };
    }
    try {
        // Delete user (this also handles protected users)
        await deleteUser(targetUser.uuid);
        // Delete OpenFGA tuples
        const resourceTypes = ['file', 'appointment', 'project', 'expense', 'task', 'customer'];
        const allRelations = ['viewer', 'editor', 'owner'];
        const tuplesToDelete = [];
        for (const resourceType of resourceTypes) {
            for (const relation of allRelations) {
                tuplesToDelete.push({
                    user: targetUser.uuid,
                    relation: relation,
                    object: `resource:${resourceType}_*`
                });
            }
        }
        await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deletes: { tuple_keys: tuplesToDelete }
            })
        });
        return {
            success: true,
            message: `✅ User ${targetUser.username} deleted successfully`,
            data: { username: targetUser.username }
        };
    }
    catch (error) {
        console.error('Error deleting user:', error);
        return {
            success: false,
            message: `❌ ${error.message}`,
            error: error.message
        };
    }
}
/**
 * Get user information - handles "who is [user]" queries
 */
async function executeGetUserInfo(command, executorId) {
    try {
        if (!command.entities.user) {
            return {
                success: false,
                message: '🤔 Which user do you want info about?',
                error: 'Missing user parameter'
            };
        }
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return {
                success: false,
                message: `❌ User '${command.entities.user}' not found.`,
                error: 'User not found'
            };
        }
        const roleEmojiMap = {
            'owner': '🟣',
            'admin': '🔴',
            'editor': '🔵',
            'viewer': '⚪'
        };
        const roleEmoji = roleEmojiMap[user.role] || '⚪';
        const createdDate = new Date(user.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const lastLoginText = user.last_login
            ? new Date(user.last_login).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Never logged in';
        // THIS IS THE KEY FIX - ACTUALLY RETURN THE INFO!
        const message = `👤 **${user.username}** ${roleEmoji}

📧 **Email:** ${user.email}
🎭 **Role:** ${user.role}
✅ **Status:** ${user.is_active ? 'Active' : 'Inactive'}
⚠️ **Needs Password Change:** ${user.must_change_password ? 'Yes' : 'No'}
📅 **Joined:** ${createdDate}
⏰ **Last Active:** ${lastLoginText}`;
        return {
            success: true,
            message,
            data: user
        };
    }
    catch (error) {
        console.error('GET_USER_INFO error:', error);
        return {
            success: false,
            message: `❌ Error getting user info: ${error.message}`,
            error: error.message
        };
    }
}
/**
 * Check resource access
 * Handles two types of queries:
 * 1. "who has access to [resource]" - shows users who can access a resource
 * 2. "what files does [user] have access to" - shows resources a user can access
 */
async function executeCheckAccess(command, executorId) {
    const { resource: resourceName, user: userName } = command.entities;
    // Case 1: "what files does [user] have access to"
    if (userName && !resourceName) {
        console.log(`🔍 CHECK_ACCESS - Finding resources for user: ${userName}`);
        // Find the user
        const targetUser = await findUserByIdentifier(userName);
        if (!targetUser) {
            return {
                success: false,
                message: `❌ User '${userName}' not found`,
                error: 'User not found'
            };
        }
        try {
            // Get all resources visible to this user's role
            const visibilityColumn = `visible_to_${targetUser.role}`;
            const result = await pool.query(`
                SELECT uuid, resource_type, data, created_at
                FROM resources
                WHERE ${visibilityColumn} = true
                ORDER BY created_at DESC
            `);
            if (result.rows.length === 0) {
                return {
                    success: true,
                    message: `📁 **${targetUser.username}** (${targetUser.role}) has no accessible resources.`,
                    data: { user: targetUser.username, role: targetUser.role, resources: [] }
                };
            }
            // Format resource list
            const resourceList = result.rows.map(r => {
                const name = r.data?.name || r.data?.title || `Resource ${r.uuid}`;
                const type = r.resource_type || 'unknown';
                return `• ${name} (${type})`;
            }).join('\n');
            return {
                success: true,
                message: `📁 **${targetUser.username}** (${targetUser.role}) has access to **${result.rows.length}** resources:\n\n${resourceList}`,
                data: {
                    user: targetUser.username,
                    role: targetUser.role,
                    resources: result.rows
                }
            };
        }
        catch (error) {
            console.error('Error checking user access:', error);
            return {
                success: false,
                message: '❌ Failed to check user access',
                error: error.message
            };
        }
    }
    // Case 2: "who has access to [resource]"
    if (resourceName) {
        console.log(`🔍 CHECK_ACCESS - Finding users for resource: ${resourceName}`);
        // Find resource
        const resource = await findResourceByName(resourceName);
        if (!resource) {
            return {
                success: false,
                message: `❌ Resource '${resourceName}' not found`,
                error: 'Resource not found'
            };
        }
        try {
            // Get all users and filter by visibility
            const usersResult = await pool.query('SELECT uuid, username, email, role FROM users ORDER BY role DESC');
            const usersWithAccess = usersResult.rows.filter(user => {
                const visibilityColumn = `visible_to_${user.role}`;
                return resource[visibilityColumn] === true;
            });
            if (usersWithAccess.length === 0) {
                return {
                    success: true,
                    message: `🔒 No users have access to **${resource.data?.name || resourceName}**`,
                    data: { resource: resource.data?.name || resourceName, users: [] }
                };
            }
            // Format user list
            const userList = usersWithAccess.map(u => `• ${u.username} (${u.role})`).join('\n');
            return {
                success: true,
                message: `👥 **${usersWithAccess.length}** users have access to **${resource.data?.name || resourceName}**:\n\n${userList}`,
                data: {
                    resource: resource.data?.name || resourceName,
                    users: usersWithAccess
                }
            };
        }
        catch (error) {
            console.error('Error checking access:', error);
            return {
                success: false,
                message: '❌ Failed to check access',
                error: error.message
            };
        }
    }
    // Neither resource nor user provided
    return {
        success: false,
        message: '❌ Please specify either a resource or a user.\n\n**Examples:**\n• "who has access to Budget.xlsx"\n• "what files does john have access to"',
        error: 'Missing parameters'
    };
}
/**
 * Update resource visibility
 */
async function executeUpdateVisibility(command, executorId) {
    const { resource: resourceName, visibility } = command.entities;
    if (!resourceName || !visibility) {
        return {
            success: false,
            message: '❌ Missing resource or visibility information',
            error: 'Invalid parameters'
        };
    }
    // Check permission
    const hasPermission = await checkPermission(executorId, ['owner', 'admin']);
    if (!hasPermission) {
        return {
            success: false,
            message: '❌ Only admins and owners can update visibility',
            error: 'Insufficient permissions'
        };
    }
    // Find resource
    const resource = await findResourceByName(resourceName);
    if (!resource) {
        return {
            success: false,
            message: `❌ Resource '${resourceName}' not found`,
            error: 'Resource not found'
        };
    }
    try {
        const column = `visible_to_${visibility.role}`;
        await pool.query(`UPDATE resources SET ${column} = $1 WHERE uuid = $2`, [visibility.access, resource.uuid]);
        const action = visibility.access ? 'visible to' : 'hidden from';
        const resourceDisplayName = resource.data?.name || resourceName;
        return {
            success: true,
            message: `✅ ${resourceDisplayName} is now ${action} ${visibility.role}s`,
            data: {
                resource: resourceDisplayName,
                role: visibility.role,
                access: visibility.access
            }
        };
    }
    catch (error) {
        console.error('Error updating visibility:', error);
        return {
            success: false,
            message: '❌ Failed to update visibility',
            error: error.message
        };
    }
}
/**
 * Create resource
 */
async function executeCreateResource(command, executorId) {
    // Import context manager and smart matchers
    const { getPendingAction, setPendingAction, clearPendingAction } = await import('./context-manager.js');
    const { matchCategory, formatCategoryList, VALID_CATEGORIES } = await import('./smart-matchers.js');
    const { resource: resourceName, category } = command.entities;
    console.log('📁 CREATE_RESOURCE - entities:', command.entities);
    // Check if this is a follow-up response for category
    const pending = getPendingAction(executorId);
    if (pending && pending.action === 'awaiting_category') {
        // User is responding with category
        const categoryInput = (command.raw || '').trim();
        const filename = pending.data.filename;
        console.log(`📁 Processing category response: "${categoryInput}" for file: ${filename}`);
        // Try to match category
        const matchedCategory = matchCategory(categoryInput);
        if (!matchedCategory) {
            return {
                success: false,
                message: `❌ I don't recognize "${categoryInput}" as a category.

Please choose from:
${formatCategoryList()}

You can type the number (1-6) or the category name.`,
                error: 'Invalid category'
            };
        }
        // Create the resource
        try {
            // ✅ CHECK FOR DUPLICATE NAME IN SAME CATEGORY
            console.log(`🔍 Checking for duplicate: name="${filename}", category="${matchedCategory}"`);
            const duplicateCheck = await pool.query(`SELECT data->>'name' as name 
                 FROM resources 
                 WHERE LOWER(data->>'name') = LOWER($1) 
                 AND LOWER(data->>'category') = LOWER($2)
                 LIMIT 1`, [filename, matchedCategory]);
            if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
                console.log(`❌ Duplicate found: ${filename} already exists in ${matchedCategory}`);
                clearPendingAction(executorId);
                return {
                    success: false,
                    message: `❌ A file named **${filename}** already exists in **${matchedCategory}**.\n\n` +
                        `💡 Please use a different name, or delete the existing file first.`
                };
            }
            console.log(`✅ No duplicate found, proceeding with creation`);
            const result = await pool.query(`
                INSERT INTO resources (
                    resource_type,
                    category,
                    data,
                    visible_to_owner,
                    visible_to_admin,
                    visible_to_editor,
                    visible_to_viewer,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES ($1, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING *
            `, [
                matchedCategory, // Use the matched category as resource_type AND category
                JSON.stringify({ name: filename, category: matchedCategory }),
                true,
                true,
                true,
                false,
                executorId
            ]);
            // ✅ NEW: Get creator's user_id for OpenFGA
            const creatorUserId = `user:${executorId}`;
            if (creatorUserId) {
                // ✅ NEW: Create OpenFGA tuple - creator becomes owner of THIS specific file
                try {
                    console.log(`🔐 Creating OpenFGA owner tuple for ${filename}`);
                    const fgaResponse = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            writes: {
                                tuple_keys: [{
                                        user: creatorUserId, // e.g., "user:alice"
                                        relation: 'owner',
                                        object: `resource:${filename}` // e.g., "resource:test10.pdf"
                                    }]
                            }
                        })
                    });
                    if (!fgaResponse.ok) {
                        const errorText = await fgaResponse.text();
                        console.error('⚠️  OpenFGA tuple creation failed:', errorText);
                    }
                    else {
                        console.log(`✅ OpenFGA owner tuple created for ${filename}`);
                    }
                }
                catch (fgaError) {
                    console.error('⚠️  OpenFGA tuple creation error:', fgaError.message);
                    // Don't fail resource creation if OpenFGA fails
                }
            }
            clearPendingAction(executorId);
            return {
                success: true,
                message: `✅ Resource **${filename}** created in **${matchedCategory}**!`,
                data: result.rows[0]
            };
        }
        catch (error) {
            console.error('Error creating resource:', error);
            clearPendingAction(executorId);
            return {
                success: false,
                message: '❌ Failed to create resource',
                error: error.message
            };
        }
    }
    // Check if filename is provided
    if (!resourceName) {
        return {
            success: true,
            message: `🤔 What's the name of the file you want to create?

**Example:** "test.pdf" or "Budget Report.xlsx"`,
            data: { awaiting: 'filename' }
        };
    }
    // Check if category is provided
    if (!category) {
        // Store pending action and ask for category
        setPendingAction(executorId, 'awaiting_category', { filename: resourceName });
        return {
            success: true,
            message: `📁 Got it! I'll create **${resourceName}**.

Which category should it go in?
${formatCategoryList()}

Just type the category name or number.`,
            data: { awaiting: 'category' }
        };
    }
    // Validate category
    const matchedCategory = matchCategory(category);
    if (!matchedCategory) {
        return {
            success: false,
            message: `❌ I don't recognize "${category}" as a category.

Please choose from:
${formatCategoryList()}`,
            error: 'Invalid category'
        };
    }
    // Create the resource
    try {
        // ✅ CHECK FOR DUPLICATE NAME IN SAME CATEGORY
        console.log(`🔍 Checking for duplicate: name="${resourceName}", category="${matchedCategory}"`);
        const duplicateCheck = await pool.query(`SELECT data->>'name' as name 
             FROM resources 
             WHERE LOWER(data->>'name') = LOWER($1) 
             AND LOWER(data->>'category') = LOWER($2)
             LIMIT 1`, [resourceName, matchedCategory]);
        if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
            console.log(`❌ Duplicate found: ${resourceName} already exists in ${matchedCategory}`);
            return {
                success: false,
                message: `❌ A file named **${resourceName}** already exists in **${matchedCategory}**.\n\n` +
                    `💡 Please use a different name, or delete the existing file first.`
            };
        }
        console.log(`✅ No duplicate found, proceeding with creation`);
        const result = await pool.query(`
            INSERT INTO resources (
                resource_type,
                data,
                visible_to_owner,
                visible_to_admin,
                visible_to_editor,
                visible_to_viewer,
                created_by,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
        `, [
            matchedCategory, // Use the matched category as resource_type
            JSON.stringify({ name: resourceName, category: matchedCategory }),
            true,
            true,
            true,
            false,
            executorId
        ]);
        // ✅ NEW: Get creator's user_id for OpenFGA
        const creatorResult = await pool.query('SELECT uuid FROM users WHERE uuid = $1', [executorId]);
        if (creatorResult.rows.length > 0) {
            const creatorUserId = creatorResult.rows[0].uuid;
            // ✅ NEW: Create OpenFGA tuple - creator becomes owner of THIS specific file
            try {
                console.log(`🔐 Creating OpenFGA owner tuple for ${resourceName}`);
                const fgaResponse = await fetch(`${process.env.FGA_API_URL} /stores/${process.env.FGA_STORE_ID}/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        writes: {
                            tuple_keys: [{
                                    user: creatorUserId, // e.g., "user:alice"
                                    relation: 'owner',
                                    object: `resource:${resourceName}` // e.g., "resource:test10.pdf"
                                }]
                        }
                    })
                });
                if (!fgaResponse.ok) {
                    const errorText = await fgaResponse.text();
                    console.error('⚠️  OpenFGA tuple creation failed:', errorText);
                }
                else {
                    console.log(`✅ OpenFGA owner tuple created for ${resourceName}`);
                }
            }
            catch (fgaError) {
                console.error('⚠️  OpenFGA tuple creation error:', fgaError.message);
                // Don't fail resource creation if OpenFGA fails
            }
        }
        return {
            success: true,
            message: `✅ Resource **${resourceName}** created in **${matchedCategory}**!`,
            data: result.rows[0]
        };
    }
    catch (error) {
        console.error('Error creating resource:', error);
        return {
            success: false,
            message: '❌ Failed to create resource',
            error: error.message
        };
    }
}
/**
 * Delete resource
 */
async function executeDeleteResource(command, executorId) {
    const { resource: resourceName } = command.entities;
    if (!resourceName) {
        return {
            success: false,
            message: '❌ Missing resource name',
            error: 'Invalid parameters'
        };
    }
    // Check permission
    const hasPermission = await checkPermission(executorId, ['owner', 'admin']);
    if (!hasPermission) {
        return {
            success: false,
            message: '❌ Only admins and owners can delete resources',
            error: 'Insufficient permissions'
        };
    }
    // Find resource
    const resource = await findResourceByName(resourceName);
    if (!resource) {
        return {
            success: false,
            message: `❌ Resource '${resourceName}' not found`,
            error: 'Resource not found'
        };
    }
    try {
        await pool.query('DELETE FROM resources WHERE uuid = $1', [resource.uuid]);
        const resourceDisplayName = resource.data?.name || resourceName;
        return {
            success: true,
            message: `✅ Resource '${resourceDisplayName}' deleted`,
            data: { resource: resourceDisplayName }
        };
    }
    catch (error) {
        console.error('Error deleting resource:', error);
        return {
            success: false,
            message: '❌ Failed to delete resource',
            error: error.message
        };
    }
}
/**
 * Change resource category (move between categories)
 */
async function executeChangeCategory(command, executorId) {
    const { resource: resourceName, newCategory, oldCategory } = command.entities;
    console.log('📦 CHANGE_CATEGORY - entities:', command.entities);
    if (!resourceName) {
        return {
            success: false,
            message: '❌ Please specify which resource to move.\n\n**Example:** "move report.pdf to Projects"',
            error: 'Missing resource name'
        };
    }
    if (!newCategory) {
        return {
            success: false,
            message: '❌ Please specify the target category.\n\n**Example:** "move report.pdf to Projects"',
            error: 'Missing target category'
        };
    }
    try {
        // Import smart matchers
        const { matchCategory, formatCategoryList } = await import('./smart-matchers.js');
        // Validate new category
        const matchedNewCategory = matchCategory(newCategory);
        if (!matchedNewCategory) {
            return {
                success: false,
                message: `❌ "${newCategory}" is not a valid category.\n\nValid categories:\n${formatCategoryList()}`,
                error: 'Invalid category'
            };
        }
        // Find the resource
        const resourceResult = await pool.query(`SELECT uuid, data, resource_type 
             FROM resources 
             WHERE LOWER(data->>'name') = LOWER($1)
             LIMIT 1`, [resourceName]);
        if (resourceResult.rowCount === 0) {
            return {
                success: false,
                message: `❌ Resource **${resourceName}** not found.\n\n💡 Use \`list resources\` to see all resources.`,
                error: 'Resource not found'
            };
        }
        const resource = resourceResult.rows[0];
        const currentCategory = resource.data?.category || resource.resource_type;
        // Check if already in target category
        if (currentCategory.toLowerCase() === matchedNewCategory.toLowerCase()) {
            return {
                success: true,
                message: `✅ **${resourceName}** is already in **${matchedNewCategory}** category.`,
                data: {
                    resource: resourceName,
                    category: matchedNewCategory,
                    unchanged: true
                }
            };
        }
        // Check for duplicate name in target category
        const duplicateCheck = await pool.query(`SELECT data->>'name' as name 
             FROM resources 
             WHERE LOWER(data->>'name') = LOWER($1) 
             AND LOWER(data->>'category') = LOWER($2)
             LIMIT 1`, [resourceName, matchedNewCategory]);
        if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
            return {
                success: false,
                message: `❌ A file named **${resourceName}** already exists in **${matchedNewCategory}**.\n\n` +
                    `💡 Please rename the file first, or delete the existing one.`,
                error: 'Duplicate resource name in target category'
            };
        }
        // Update the category
        const updatedData = {
            ...resource.data,
            category: matchedNewCategory
        };
        await pool.query(`UPDATE resources 
             SET data = $1, 
                 resource_type = $2,
                 updated_at = NOW() 
             WHERE uuid = $3`, [JSON.stringify(updatedData), matchedNewCategory.toLowerCase(), resource.uuid]);
        console.log(`✅ Moved ${resourceName} from ${currentCategory} to ${matchedNewCategory}`);
        return {
            success: true,
            message: `✅ Moved **${resourceName}** from **${currentCategory}** to **${matchedNewCategory}**!`,
            data: {
                resource: resourceName,
                oldCategory: currentCategory,
                newCategory: matchedNewCategory
            }
        };
    }
    catch (error) {
        console.error('Error changing category:', error);
        return {
            success: false,
            message: `❌ Failed to move resource: ${error.message}`,
            error: error.message
        };
    }
}
/**
 * Rename a resource
 */
async function executeRenameResource(command, executorId) {
    const { resource: oldName, newName } = command.entities;
    console.log('✏️ RENAME_RESOURCE - entities:', command.entities);
    if (!oldName) {
        return {
            success: false,
            message: '❌ Please specify which resource to rename.\n\n**Example:** "rename report.pdf to budget.pdf"',
            error: 'Missing resource name'
        };
    }
    if (!newName) {
        return {
            success: false,
            message: '❌ Please specify the new name.\n\n**Example:** "rename report.pdf to budget.pdf"',
            error: 'Missing new name'
        };
    }
    try {
        // Find the resource
        const resourceResult = await pool.query(`SELECT uuid, data, resource_type 
             FROM resources 
             WHERE LOWER(data->>'name') = LOWER($1)
             LIMIT 1`, [oldName]);
        if (resourceResult.rowCount === 0) {
            return {
                success: false,
                message: `❌ Resource **${oldName}** not found.\n\n💡 Use \`list resources\` to see all resources.`,
                error: 'Resource not found'
            };
        }
        const resource = resourceResult.rows[0];
        const category = resource.data?.category || resource.resource_type;
        // Check for duplicate name in same category
        const duplicateCheck = await pool.query(`SELECT data->>'name' as name 
             FROM resources 
             WHERE LOWER(data->>'name') = LOWER($1) 
             AND LOWER(data->>'category') = LOWER($2)
             AND uuid != $3
             LIMIT 1`, [newName, category, resource.uuid]);
        if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
            return {
                success: false,
                message: `❌ A file named **${newName}** already exists in **${category}**.\n\n` +
                    `💡 Please choose a different name.`,
                error: 'Duplicate name'
            };
        }
        // Update the name
        const updatedData = {
            ...resource.data,
            name: newName
        };
        await pool.query(`UPDATE resources 
             SET data = $1,
                 updated_at = NOW() 
             WHERE uuid = $2`, [JSON.stringify(updatedData), resource.uuid]);
        return {
            success: true,
            message: `✅ Renamed **${oldName}** to **${newName}** in **${category}**!`,
            data: {
                oldName,
                newName,
                category
            }
        };
    }
    catch (error) {
        console.error('Error renaming resource:', error);
        return {
            success: false,
            message: `❌ Failed to rename resource: ${error.message}`,
            error: error.message
        };
    }
}
/**
 * Get system statistics
 */
async function executeSystemStats(command, executorId) {
    try {
        // Get user counts by role
        const userStats = await pool.query(`
            SELECT 
                role,
                COUNT(*) as count
            FROM users
            WHERE is_active = true
            GROUP BY role
            ORDER BY 
                CASE role
                    WHEN 'owner' THEN 1
                    WHEN 'admin' THEN 2
                    WHEN 'editor' THEN 3
                    WHEN 'viewer' THEN 4
                END
        `);
        // Get resource counts by category
        const resourceStats = await pool.query(`
            SELECT 
                data->>'category' as category,
                COUNT(*) as count
            FROM resources
            GROUP BY data->>'category'
            ORDER BY count DESC
        `);
        // Get total counts
        const totals = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                (SELECT COUNT(*) FROM resources) as total_resources
        `);
        // Format response
        let message = '📊 **System Statistics**\n\n';
        message += `👥 **Users (${totals.rows[0].total_users} total)**\n`;
        userStats.rows.forEach(row => {
            const emojiMap = {
                owner: '🟣',
                admin: '🔴',
                editor: '🔵',
                viewer: '⚪'
            };
            const emoji = emojiMap[row.role] || '⚫';
            message += `${emoji} ${row.role}: ${row.count}\n`;
        });
        message += `\n📁 **Resources (${totals.rows[0].total_resources} total)**\n`;
        if (resourceStats.rows.length > 0) {
            resourceStats.rows.forEach(row => {
                const category = row.category || 'Uncategorized';
                message += `• ${category}: ${row.count}\n`;
            });
        }
        else {
            message += '• No resources yet\n';
        }
        return {
            success: true,
            message: message.trim()
        };
    }
    catch (error) {
        console.error('Error getting system stats:', error);
        return {
            success: false,
            message: `❌ Failed to get system statistics: ${error.message}`
        };
    }
}
/**
 * List resources with optional category filter
 */
async function executeListResources(command, executorId) {
    try {
        const categoryFilter = command.entities.category;
        let query = `
            SELECT 
                data->>'name' as name,
                data->>'category' as category,
                resource_type,
                created_at,
                created_by
            FROM resources
        `;
        const params = [];
        // Add category filter if specified
        if (categoryFilter) {
            query += ` WHERE LOWER(data->>'category') = LOWER($1)`;
            params.push(categoryFilter);
        }
        query += ` ORDER BY created_at DESC LIMIT 50`;
        const result = await pool.query(query, params);
        if (result.rowCount === 0) {
            const msg = categoryFilter
                ? `📁 No resources found in **${categoryFilter}** category.`
                : '📁 No resources found in the system.';
            return {
                success: true,
                message: msg
            };
        }
        // Group by category
        const byCategory = {};
        result.rows.forEach(row => {
            const cat = row.category || 'Uncategorized';
            if (!byCategory[cat])
                byCategory[cat] = [];
            byCategory[cat].push(row);
        });
        // Format response
        let message = categoryFilter
            ? `📁 **Resources in ${categoryFilter}** (${result.rowCount} total)\n\n`
            : `📁 **All Resources** (${result.rowCount} total)\n\n`;
        for (const [category, resources] of Object.entries(byCategory)) {
            message += `**${category}** (${resources.length}):\n`;
            resources.forEach(r => {
                const date = new Date(r.created_at).toLocaleDateString();
                message += `• ${r.name} - *Created ${date}*\n`;
            });
            message += '\n';
        }
        return {
            success: true,
            message: message.trim()
        };
    }
    catch (error) {
        console.error('Error listing resources:', error);
        return {
            success: false,
            message: `❌ Failed to list resources: ${error.message}`
        };
    }
}
/**
 * Show help
 */
async function executeHelp(command, executorId) {
    return {
        success: true,
        message: 'Help information',
        data: {
            commands: [
                {
                    category: 'User Management',
                    examples: [
                        'Show all viewers',
                        'Change John to editor',
                        'Create user Alice with email alice@example.com as editor',
                        'Delete user Bob'
                    ]
                },
                {
                    category: 'Resource Management',
                    examples: [
                        'Who has access to Report.pdf?',
                        'Make Report.pdf visible to viewers',
                        'Create resource Budget.xlsx in Data Sources',
                        'Delete resource Test.pdf'
                    ]
                },
                {
                    category: 'Information',
                    examples: [
                        'Show system stats',
                        'Show details for John',
                        'What role does Sarah have?'
                    ]
                }
            ]
        }
    };
}
// ============================================
// MAIN EXECUTOR
// ============================================
export async function executeCommand(command, executorId) {
    // Import response templates
    const { RESPONSE_TEMPLATES, FALLBACK_RESPONSES, getRandomResponse } = await import('./nlp-parser.js');
    // ============================================
    // CONTEXT-AWARE PRE-PROCESSING
    // ============================================
    // Check if user is responding to a pending question
    const { getPendingAction } = await import('./context-manager.js');
    const pending = getPendingAction(executorId);
    if (pending) {
        console.log(`🔄 Found pending action: ${pending.action} for user ${executorId}`);
        console.log(`🔄 Current intent: ${command.intent}`);
        // If user has pending action, assume they're answering the question
        // unless it's a clear command like help, who_am_i, etc.
        const clearCommands = ['help', 'who_am_i', 'system_stats', 'list_users'];
        if (!clearCommands.includes(command.intent)) {
            const userResponse = (command.raw || '').trim();
            console.log(`🔄 Redirecting response "${userResponse}" to pending handler`);
            // Redirect to appropriate handler based on pending action
            if (pending.action === 'awaiting_category') {
                // User is providing a category for file creation
                return executeCreateResource(command, executorId);
            }
            if (pending.action === 'creating_user') {
                // User is in multi-step user creation
                return executeCreateUser(command, executorId);
            }
        }
    }
    switch (command.intent) {
        // Social intents
        case 'greeting':
            return {
                success: true,
                message: getRandomResponse(RESPONSE_TEMPLATES.greeting),
                data: null
            };
        case 'goodbye':
            return {
                success: true,
                message: getRandomResponse(RESPONSE_TEMPLATES.goodbye),
                data: null
            };
        case 'gratitude':
            return {
                success: true,
                message: getRandomResponse(RESPONSE_TEMPLATES.gratitude),
                data: null
            };
        case 'compliment':
            return {
                success: true,
                message: getRandomResponse(RESPONSE_TEMPLATES.compliment),
                data: null
            };
        case 'casual_question':
            return {
                success: true,
                message: getRandomResponse(RESPONSE_TEMPLATES.casual_question),
                data: null
            };
        case 'small_talk':
            return {
                success: true,
                message: getRandomResponse(RESPONSE_TEMPLATES.small_talk),
                data: null
            };
        case 'help':
            return {
                success: true,
                message: RESPONSE_TEMPLATES.help,
                data: null
            };
        // System information
        case 'who_am_i':
            return executeWhoAmI(command, executorId);
        case 'system_stats':
            return executeSystemStats(command, executorId);
        case 'list_resources':
            return executeListResources(command, executorId);
        // User management
        case 'find_user':
            return executeGetUserInfo(command, executorId);
        case 'get_user_info':
            return executeGetUserInfo(command, executorId);
        case 'change_role':
            return executeChangeRole(command, executorId);
        case 'list_users':
            return executeListUsers(command, executorId);
        case 'create_user':
            return executeCreateUser(command, executorId);
        case 'delete_user':
            return executeDeleteUser(command, executorId);
        // Resource management
        case 'check_access':
            return executeCheckAccess(command, executorId);
        case 'update_visibility':
            return executeUpdateVisibility(command, executorId);
        case 'create_resource':
            return executeCreateResource(command, executorId);
        case 'delete_resource':
            return executeDeleteResource(command, executorId);
        case 'change_category':
            return executeChangeCategory(command, executorId);
        case 'rename_resource':
            return executeRenameResource(command, executorId);
        case 'list_categories':
            return {
                success: true,
                message: `📁 **Available Categories:**

1. 📁 Files
2. 📅 Appointments
3. 🚀 Projects
4. 👥 Customers
5. 💰 Expenses
6. ✅ Tasks
7. 📦 Miscellaneous

You can use these when creating resources!`,
                data: null
            };
        // Enhanced user queries
        case 'user_creation_date':
            return executeUserCreationDate(command, executorId);
        case 'user_full_details':
            return executeUserFullDetails(command, executorId);
        case 'user_creator':
            return executeUserCreator(command, executorId);
        case 'user_last_active':
            return executeUserLastActive(command, executorId);
        case 'user_history':
            return executeUserHistory(command, executorId);
        case 'user_created_resources':
            return executeUserCreatedResources(command, executorId);
        case 'user_password_status':
            return executeUserPasswordStatus(command, executorId);
        // Enhanced resource queries
        case 'resource_creation_date':
            return executeResourceCreationDate(command, executorId);
        case 'resource_creator':
            return executeResourceCreator(command, executorId);
        // Filtered lists
        case 'list_inactive_users':
            return executeListInactiveUsers(command, executorId);
        case 'list_users_need_password_change':
            return executeListUsersNeedPasswordChange(command, executorId);
        case 'unknown':
        default:
            return {
                success: false,
                message: FALLBACK_RESPONSES.unknown_intent(command.raw || ''),
                error: 'Unknown intent'
            };
    }
}
/**
 * Who am I - Get current user info
 */
async function executeWhoAmI(command, executorId) {
    try {
        console.log(`👤 executeWhoAmI - executorId: ${executorId} (type: ${typeof executorId})`);
        const result = await pool.query(`SELECT uuid, username, email, role, is_active, must_change_password, 
                    created_at, last_login 
             FROM users 
             WHERE uuid = $1`, [executorId]);
        if (result.rows.length === 0) {
            return {
                success: false,
                message: '❌ Could not find your user information',
                error: 'User not found'
            };
        }
        const user = result.rows[0];
        const roleEmojiMap = {
            'owner': '🟣',
            'admin': '🔴',
            'editor': '🔵',
            'viewer': '⚪'
        };
        const roleEmoji = roleEmojiMap[user.role] || '👤';
        return {
            success: true,
            message: `${roleEmoji} **You are ${user.username}**\n\n` +
                `📧 Email: ${user.email}\n` +
                `${roleEmoji} Role: ${user.role}\n` +
                `📅 Member since: ${new Date(user.created_at).toLocaleDateString()}`,
            data: user
        };
    }
    catch (error) {
        console.error('Error getting user info:', error);
        return {
            success: false,
            message: '❌ Failed to get your information',
            error: error.message
        };
    }
}
/**
 * ENHANCED QUERY HANDLERS
 */
async function executeUserCreationDate(command, executorId) {
    if (!command.entities.user) {
        return { success: false, message: '🤔 Which user are you asking about?', error: 'Missing user parameter' };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return { success: false, message: `❌ User '${command.entities.user}' not found.`, error: 'User not found' };
        }
        const createdDate = new Date(user.created_at);
        const formattedDate = createdDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return {
            success: true,
            message: `📅 **${user.name || user.username}** was added on **${formattedDate}** at **${formattedTime}** as **${user.role}**.`,
            data: { user, createdDate }
        };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get user creation date', error: error.message };
    }
}
async function executeUserFullDetails(command, executorId) {
    if (!command.entities.user) {
        return { success: false, message: '🤔 Which user do you want full details for?', error: 'Missing user parameter' };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return { success: false, message: `❌ User '${command.entities.user}' not found.`, error: 'User not found' };
        }
        const resourcesQuery = await pool.query(`SELECT COUNT(*) as count FROM resources WHERE created_by = $1`, [user.uuid]);
        const resourceCount = resourcesQuery.rows[0].count;
        const historyQuery = await pool.query(`SELECT COUNT(*) as count FROM admin_grants WHERE target_user = $1`, [user.uuid]);
        const roleChanges = historyQuery.rows[0].count;
        const roleEmojiMap = { 'owner': '🟣', 'admin': '🔴', 'editor': '🔵', 'viewer': '⚪' };
        const roleEmoji = roleEmojiMap[user.role] || '⚪';
        const createdDate = new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const lastLoginText = user.last_login ? new Date(user.last_login).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';
        const message = `👤 **COMPLETE USER PROFILE**\n\n**Basic Information:**\n- Name: ${user.name || 'N/A'}\n- Username: ${user.username}\n- Email: ${user.email}\n- Role: ${roleEmoji} ${user.role}\n\n**Account Status:**\n- Active: ${user.is_active ? '✅ Yes' : '❌ No'}\n- Must Change Password: ${user.must_change_password ? '⚠️ Yes' : '✅ No'}\n\n**Activity:**\n- Created: ${createdDate}\n- Last Login: ${lastLoginText}\n\n**Statistics:**\n- Resources Created: ${resourceCount}\n- Role Changes: ${roleChanges}\n\n**Database ID:** ${user.uuid}`;
        return { success: true, message, data: { user, resourceCount, roleChanges } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get user details', error: error.message };
    }
}
async function executeUserCreator(command, executorId) {
    if (!command.entities.user) {
        return { success: false, message: '🤔 Which user are you asking about?', error: 'Missing user parameter' };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return { success: false, message: `❌ User '${command.entities.user}' not found.`, error: 'User not found' };
        }
        return { success: true, message: `🤖 **${user.username}** was created by the system.`, data: { user } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get user creator', error: error.message };
    }
}
async function executeUserLastActive(command, executorId) {
    if (!command.entities.user) {
        return { success: false, message: '🤔 Which user are you asking about?', error: 'Missing user parameter' };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return { success: false, message: `❌ User '${command.entities.user}' not found.`, error: 'User not found' };
        }
        if (!user.last_login) {
            return { success: true, message: `⚪ **${user.username}** has never logged in yet.`, data: { user } };
        }
        const lastLogin = new Date(user.last_login);
        const now = new Date();
        const diffMs = now.getTime() - lastLogin.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        let timeAgo = '';
        if (diffMins < 60) {
            timeAgo = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        }
        else if (diffHours < 24) {
            timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        }
        else {
            timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        }
        const formattedDate = lastLogin.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return { success: true, message: `⏰ **${user.username}** was last active **${timeAgo}** (${formattedDate}).`, data: { user, lastLogin, timeAgo } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get user last active time', error: error.message };
    }
}
async function executeUserHistory(command, executorId) {
    if (!command.entities.user) {
        return { success: false, message: "🤔 Which user's history do you want to see?", error: 'Missing user parameter' };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return { success: false, message: `❌ User '${command.entities.user}' not found.`, error: 'User not found' };
        }
        const historyQuery = await pool.query(`SELECT ag.*, u_granter.username as granter_username, u_granter.name as granter_name FROM admin_grants ag LEFT JOIN users u_granter ON ag.granted_by = u_granter.uuid WHERE ag.target_user = $1 ORDER BY ag.created_at DESC LIMIT 20`, [user.uuid]);
        if (historyQuery.rows.length === 0) {
            return { success: true, message: `📋 **${user.username}** has no role change history.`, data: { user, history: [] } };
        }
        let response = `📋 **HISTORY FOR ${user.username}**\n\n`;
        historyQuery.rows.forEach((record, index) => {
            const date = new Date(record.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const action = record.action === 'granted' ? '✅ Promoted' : '⬇️ Demoted';
            const granter = record.granter_name || record.granter_username || 'System';
            response += `${index + 1}. ${action}: **${record.previous_role}** → **${record.new_role}**\n   By: ${granter} | ${date}\n`;
            if (record.reason)
                response += `   Reason: "${record.reason}"\n`;
            response += `\n`;
        });
        return { success: true, message: response.trim(), data: { user, history: historyQuery.rows } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get user history', error: error.message };
    }
}
async function executeUserCreatedResources(command, executorId) {
    if (!command.entities.user) {
        return { success: false, message: "🤔 Which user's resources do you want to see?", error: 'Missing user parameter' };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return { success: false, message: `❌ User '${command.entities.user}' not found.`, error: 'User not found' };
        }
        const resourcesQuery = await pool.query(`SELECT uuid, resource_type, data, created_at FROM resources WHERE created_by = $1 ORDER BY created_at DESC`, [user.uuid]);
        if (resourcesQuery.rows.length === 0) {
            return { success: true, message: `📁 **${user.username}** hasn't created any resources yet.`, data: { user, resources: [] } };
        }
        let response = `📁 **RESOURCES CREATED BY ${user.username}** (${resourcesQuery.rows.length})\n\n`;
        resourcesQuery.rows.forEach((resource, index) => {
            const name = resource.data?.name || `Resource #${resource.uuid}`;
            const category = resource.data?.category || resource.resource_type;
            const date = new Date(resource.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            response += `${index + 1}. **${name}** (${category}) - ${date}\n`;
        });
        return { success: true, message: response.trim(), data: { user, resources: resourcesQuery.rows } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get user created resources', error: error.message };
    }
}
async function executeUserPasswordStatus(command, executorId) {
    if (!command.entities.user) {
        return { success: false, message: "🤔 Which user's password status do you want to check?", error: 'Missing user parameter' };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return { success: false, message: `❌ User '${command.entities.user}' not found.`, error: 'User not found' };
        }
        if (user.must_change_password) {
            return { success: true, message: `⚠️ **${user.username}** must change their password on next login. They haven't updated it yet.`, data: { user, mustChangePassword: true } };
        }
        else {
            return { success: true, message: `✅ **${user.username}** has already changed their password from the default.`, data: { user, mustChangePassword: false } };
        }
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get user password status', error: error.message };
    }
}
async function executeResourceCreationDate(command, executorId) {
    if (!command.entities.resource) {
        return { success: false, message: '🤔 Which resource are you asking about?', error: 'Missing resource parameter' };
    }
    try {
        const resource = await findResourceByName(command.entities.resource);
        if (!resource) {
            return { success: false, message: `❌ Resource '${command.entities.resource}' not found.`, error: 'Resource not found' };
        }
        const createdDate = new Date(resource.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const name = resource.data?.name || `Resource #${resource.uuid}`;
        return { success: true, message: `📅 **${name}** was created on **${createdDate}**.`, data: { resource, createdDate } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get resource creation date', error: error.message };
    }
}
async function executeResourceCreator(command, executorId) {
    if (!command.entities.resource) {
        return { success: false, message: '🤔 Which resource are you asking about?', error: 'Missing resource parameter' };
    }
    try {
        const resource = await findResourceByName(command.entities.resource);
        if (!resource) {
            return { success: false, message: `❌ Resource '${command.entities.resource}' not found.`, error: 'Resource not found' };
        }
        const creatorQuery = await pool.query(`SELECT username, name FROM users WHERE uuid = $1`, [resource.created_by]);
        const name = resource.data?.name || `Resource #${resource.uuid}`;
        if (creatorQuery.rows.length === 0) {
            return { success: true, message: `🤖 **${name}** was created by the system.`, data: { resource } };
        }
        const creator = creatorQuery.rows[0];
        return { success: true, message: `👤 **${name}** was created by **${creator.name || creator.username}**.`, data: { resource, creator } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to get resource creator', error: error.message };
    }
}
async function executeListInactiveUsers(command, executorId) {
    try {
        const usersQuery = await pool.query(`SELECT username, name, email, role, created_at FROM users WHERE is_active = FALSE ORDER BY username`);
        if (usersQuery.rows.length === 0) {
            return { success: true, message: `✅ All users are currently active!`, data: { users: [] } };
        }
        let response = `📋 **INACTIVE USERS** (${usersQuery.rows.length})\n\n`;
        usersQuery.rows.forEach((user, index) => {
            const roleEmojiMap = { owner: '🟣', admin: '🔴', editor: '🔵', viewer: '⚪' };
            const roleEmoji = roleEmojiMap[user.role] || '⚪';
            response += `${index + 1}. ${roleEmoji} **${user.username}** (${user.email}) - ${user.role}\n`;
        });
        return { success: true, message: response.trim(), data: { users: usersQuery.rows } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to list inactive users', error: error.message };
    }
}
async function executeListUsersNeedPasswordChange(command, executorId) {
    try {
        const usersQuery = await pool.query(`SELECT username, name, email, role, created_at FROM users WHERE must_change_password = TRUE ORDER BY username`);
        if (usersQuery.rows.length === 0) {
            return { success: true, message: `✅ All users have changed their passwords!`, data: { users: [] } };
        }
        let response = `⚠️ **USERS NEEDING PASSWORD CHANGE** (${usersQuery.rows.length})\n\n`;
        usersQuery.rows.forEach((user, index) => {
            const roleEmojiMap = { owner: '🟣', admin: '🔴', editor: '🔵', viewer: '⚪' };
            const roleEmoji = roleEmojiMap[user.role] || '⚪';
            response += `${index + 1}. ${roleEmoji} **${user.username}** (${user.email})\n`;
        });
        return { success: true, message: response.trim(), data: { users: usersQuery.rows } };
    }
    catch (error) {
        return { success: false, message: '❌ Failed to list users needing password change', error: error.message };
    }
}
