"use strict";
/**
 * Bulk update visibility for all resources in a category
 */
async function executeBulkVisibility(command, executorId) {
    const { category, visibility } = command.entities;
    if (!category || !visibility) {
        return {
            success: false,
            message: '❌ Missing category or visibility information',
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
    // Match category
    const { matchCategory } = await import('./smart-matchers.js');
    const matchedCategory = matchCategory(category);
    if (!matchedCategory) {
        return {
            success: false,
            message: `❌ Category '${category}' not found`,
            error: 'Invalid category'
        };
    }
    try {
        const column = `visible_to_${visibility.role}`;
        // Update all resources in this category
        const result = await pool.query(`UPDATE resources 
             SET ${column} = $1 
             WHERE resource_type = $2
             RETURNING id`, [visibility.access, matchedCategory]);
        const count = result.rowCount || 0;
        const action = visibility.access ? 'visible to' : 'hidden from';
        if (count === 0) {
            return {
                success: true,
                message: `📁 No resources found in category **${matchedCategory}**`,
                data: { category: matchedCategory, count: 0 }
            };
        }
        return {
            success: true,
            message: `✅ Updated **${count}** resources in **${matchedCategory}** - now ${action} ${visibility.role}s`,
            data: {
                category: matchedCategory,
                role: visibility.role,
                access: visibility.access,
                count: count
            }
        };
    }
    catch (error) {
        console.error('Error updating bulk visibility:', error);
        return {
            success: false,
            message: '❌ Failed to update visibility',
            error: error.message
        };
    }
}
