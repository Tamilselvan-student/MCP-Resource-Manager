import { CommandResult } from './command-executor.js';

// ============================================
// EMOJI CONSTANTS
// ============================================

const EMOJI = {
    SUCCESS: '✅',
    ERROR: '❌',
    LIST: '📋',
    USER: '👤',
    OWNER: '🟣',
    ADMIN: '🔴',
    EDITOR: '🔵',
    VIEWER: '⚪',
    RESOURCE: '📁',
    INFO: 'ℹ️',
    WARNING: '⚠️',
    STATS: '📊'
};

// ============================================
// ROLE EMOJI MAPPING
// ============================================

function getRoleEmoji(role: string): string {
    const roleMap: { [key: string]: string } = {
        'owner': EMOJI.OWNER,
        'admin': EMOJI.ADMIN,
        'editor': EMOJI.EDITOR,
        'viewer': EMOJI.VIEWER
    };
    return roleMap[role.toLowerCase()] || EMOJI.USER;
}

// ============================================
// FORMAT USER LIST
// ============================================

function formatUserList(users: any[], roleFilter?: string): string {
    if (users.length === 0) {
        const roleText = roleFilter ? `${roleFilter}s` : 'users';
        return `${EMOJI.LIST} No ${roleText} found`;
    }

    const roleText = roleFilter
        ? `${roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}s`
        : 'Users';

    let output = `${EMOJI.LIST} ${roleText} (${users.length}):\n`;

    users.forEach((user, index) => {
        const roleEmoji = getRoleEmoji(user.role);
        output += `${index + 1}. ${roleEmoji} ${user.username}`;

        if (user.email) {
            output += ` (${user.email})`;
        }

        if (user.role) {
            output += ` - ${user.role}`;
        }

        output += '\n';
    });

    return output.trim();
}

// ============================================
// FORMAT USER INFO
// ============================================

function formatUserInfo(user: any): string {
    const roleEmoji = getRoleEmoji(user.role);

    let output = `${EMOJI.USER} ${user.username}\n`;

    if (user.email) {
        output += `📧 ${user.email}\n`;
    }

    if (user.role) {
        output += `${roleEmoji} Role: ${user.role}\n`;
    }

    if (user.created_at) {
        const date = new Date(user.created_at);
        output += `📅 Created: ${date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })}`;
    }

    return output;
}

// ============================================
// FORMAT ACCESS LIST
// ============================================

function formatAccessList(resourceName: string, users: any[]): string {
    if (users.length === 0) {
        return `${EMOJI.RESOURCE} No users have access to '${resourceName}'`;
    }

    let output = `${EMOJI.RESOURCE} Users with access to '${resourceName}':\n`;

    // Group by role
    const byRole: { [key: string]: any[] } = {};
    users.forEach(user => {
        if (!byRole[user.role]) {
            byRole[user.role] = [];
        }
        byRole[user.role].push(user);
    });

    // Display in role hierarchy order
    const roleOrder = ['owner', 'admin', 'editor', 'viewer'];
    roleOrder.forEach(role => {
        if (byRole[role]) {
            byRole[role].forEach(user => {
                const roleEmoji = getRoleEmoji(role);
                output += `${roleEmoji} ${user.username}`;
                if (user.email) {
                    output += ` (${user.email})`;
                }
                output += '\n';
            });
        }
    });

    return output.trim();
}

// ============================================
// FORMAT SYSTEM STATS
// ============================================

function formatSystemStats(stats: any): string {
    let output = `${EMOJI.STATS} System Statistics\n\n`;

    output += `${EMOJI.USER} Total Users: ${stats.totalUsers}\n`;
    output += `${EMOJI.RESOURCE} Total Resources: ${stats.totalResources}\n\n`;

    if (stats.usersByRole && stats.usersByRole.length > 0) {
        output += `Users by Role:\n`;
        stats.usersByRole.forEach((roleCount: any) => {
            const roleEmoji = getRoleEmoji(roleCount.role);
            output += `${roleEmoji} ${roleCount.role}: ${roleCount.count}\n`;
        });
    }

    return output.trim();
}

// ============================================
// FORMAT HELP
// ============================================

function formatHelp(helpData: any): string {
    let output = `💬 Available Commands\n\n`;

    if (helpData.commands) {
        helpData.commands.forEach((section: any) => {
            output += `**${section.category}:**\n`;
            section.examples.forEach((example: string) => {
                output += `• ${example}\n`;
            });
            output += '\n';
        });
    }

    output += `Type any command in natural language!`;

    return output;
}

// ============================================
// MAIN FORMATTER FUNCTION
// ============================================

export function formatResponse(result: CommandResult, intent: string): string {
    // If there's a custom message, use it
    if (result.message && !result.data) {
        return result.message;
    }

    // Format based on intent and data
    if (!result.success) {
        return result.message || `${EMOJI.ERROR} An error occurred`;
    }

    switch (intent) {
        case 'list_users':
            if (result.data && Array.isArray(result.data)) {
                // Extract role filter from first user if available
                const roleFilter = result.data.length > 0 ? result.data[0].role : undefined;
                const allSameRole = result.data.every(u => u.role === roleFilter);
                return formatUserList(result.data, allSameRole ? roleFilter : undefined);
            }
            return result.message;

        case 'get_user_info':
            if (result.data) {
                return formatUserInfo(result.data);
            }
            return result.message;

        case 'check_access':
            if (result.data && result.data.users) {
                return formatAccessList(result.data.resource, result.data.users);
            }
            return result.message;

        case 'system_stats':
            if (result.data) {
                return formatSystemStats(result.data);
            }
            return result.message;

        case 'help':
            if (result.data) {
                return formatHelp(result.data);
            }
            return result.message;

        case 'change_role':
        case 'create_user':
        case 'delete_user':
        case 'update_visibility':
        case 'create_resource':
        case 'delete_resource':
        default:
            return result.message;
    }
}

// ============================================
// ERROR FORMATTER WITH SUGGESTIONS
// ============================================

export function formatError(error: string, suggestions?: string[]): string {
    let output = `${EMOJI.ERROR} ${error}`;

    if (suggestions && suggestions.length > 0) {
        output += `\n\nDid you mean:\n`;
        suggestions.forEach((suggestion, index) => {
            output += `${index + 1}. ${suggestion}\n`;
        });
    }

    return output.trim();
}

// ============================================
// SUCCESS FORMATTER
// ============================================

export function formatSuccess(message: string, details?: any): string {
    let output = `${EMOJI.SUCCESS} ${message}`;

    if (details) {
        output += '\n\n';
        Object.keys(details).forEach(key => {
            output += `${key}: ${details[key]}\n`;
        });
    }

    return output.trim();
}
