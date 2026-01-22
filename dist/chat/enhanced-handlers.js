// This file contains the handler implementations for enhanced query features
// These are imported and used by command-executor.ts
import pool from '../database.js';
import { findUserByIdentifier } from './command-executor.js';
/**
 * User creation date - When was a user added
 */
export async function executeUserCreationDate(command, executorId) {
    if (!command.entities.user) {
        return {
            success: false,
            message: '🤔 Which user are you asking about?',
            error: 'Missing user parameter'
        };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return {
                success: false,
                message: `❌ User '${command.entities.user}' not found.`,
                error: 'User not found'
            };
        }
        const creatorQuery = await pool.query(`SELECT u.username, u.name FROM users u WHERE u.user_id = $1`, [user.created_by]);
        const creator = creatorQuery.rows[0];
        const createdDate = new Date(user.created_at);
        const formattedDate = createdDate.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const formattedTime = createdDate.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
        });
        const creatorText = creator
            ? `by ${creator.name || creator.username}`
            : 'by the system';
        return {
            success: true,
            message: `📅 **${user.name || user.username}** was added on **${formattedDate}** at **${formattedTime}** ${creatorText} as **${user.role}**.`,
            data: { user, createdDate, creator }
        };
    }
    catch (error) {
        console.error('Error getting user creation date:', error);
        return {
            success: false,
            message: '❌ Failed to get user creation date',
            error: error.message
        };
    }
}
/**
 * User full details - Complete user profile
 */
export async function executeUserFullDetails(command, executorId) {
    if (!command.entities.user) {
        return {
            success: false,
            message: '🤔 Which user do you want full details for?',
            error: 'Missing user parameter'
        };
    }
    try {
        const user = await findUserByIdentifier(command.entities.user);
        if (!user) {
            return {
                success: false,
                message: `❌ User '${command.entities.user}' not found.`,
                error: 'User not found'
            };
        }
        const creatorQuery = await pool.query(`SELECT username, name FROM users WHERE user_id = $1`, [user.created_by]);
        const creator = creatorQuery.rows[0];
        const resourcesQuery = await pool.query(`SELECT COUNT(*) as count FROM resources WHERE created_by = $1`, [user.id]);
        const resourceCount = resourcesQuery.rows[0].count;
        const historyQuery = await pool.query(`SELECT COUNT(*) as count FROM admin_grants WHERE target_user = $1`, [user.user_id]);
        const roleChanges = historyQuery.rows[0].count;
        const roleEmojiMap = {
            'owner': '🟣', 'admin': '🔴', 'editor': '🔵', 'viewer': '⚪'
        };
        const roleEmoji = roleEmojiMap[user.role] || '⚪';
        const createdDate = new Date(user.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const lastLoginText = user.last_login
            ? new Date(user.last_login).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })
            : 'Never';
        const message = `👤 **COMPLETE USER PROFILE**

**Basic Information:**
- Name: ${user.name || 'N/A'}
- Username: ${user.username}
- Email: ${user.email}
- Role: ${roleEmoji} ${user.role}

**Account Status:**
- Active: ${user.is_active ? '✅ Yes' : '❌ No'}
- Must Change Password: ${user.must_change_password ? '⚠️ Yes' : '✅ No'}

**Activity:**
- Created: ${createdDate}
- Created By: ${creator ? (creator.name || creator.username) : 'Unknown'}
- Last Login: ${lastLoginText}

**Statistics:**
- Resources Created: ${resourceCount}
- Role Changes: ${roleChanges}

**Database ID:** ${user.user_id}`;
        return {
            success: true,
            message,
            data: { user, creator, resourceCount, roleChanges }
        };
    }
    catch (error) {
        console.error('Error getting user full details:', error);
        return {
            success: false,
            message: '❌ Failed to get user details',
            error: error.message
        };
    }
}
// Export all other handlers similarly...
// Due to length, I'll create a comprehensive file
