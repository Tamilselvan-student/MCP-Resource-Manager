/**
 * Smart Matchers
 * Fuzzy matching utilities for categories, roles, and validation
 */

/**
 * Valid resource categories
 */
export const VALID_CATEGORIES = [
    'file',
    'appointment',
    'project',
    'customer',
    'expense',
    'task',
    'Miscellaneous'
] as const;

/**
 * Valid user roles
 */
export const VALID_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;

/**
 * Category keywords for fuzzy matching
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'file': ['file', 'files', 'document', 'documents', 'pdf', 'doc', 'spreadsheet', 'excel', 'csv'],
    'appointment': ['appointment', 'appointments', 'meeting', 'meetings', 'calendar', 'schedule'],
    'project': ['project', 'projects', 'work', 'initiative'],
    'customer': ['customer', 'customers', 'client', 'clients', 'contact', 'contacts'],
    'expense': ['expense', 'expenses', 'cost', 'costs', 'payment', 'payments', 'money'],
    'task': ['task', 'tasks', 'todo', 'todos', 'action', 'actions'],
    'Miscellaneous': ['misc', 'miscellaneous', 'other', 'general', 'various']
};

/**
 * Match user input to a valid category
 * Supports:
 * - Exact match (case-insensitive)
 * - Partial match
 * - Keyword match
 * - Number selection (1-6)
 */
export function matchCategory(input: string): string | null {
    const lower = input.toLowerCase().trim();

    // Try number selection (1-6)
    const num = parseInt(lower);
    if (!isNaN(num) && num >= 1 && num <= VALID_CATEGORIES.length) {
        return VALID_CATEGORIES[num - 1];
    }

    // Try exact match
    const exactMatch = VALID_CATEGORIES.find(c => c.toLowerCase() === lower);
    if (exactMatch) {
        return exactMatch;
    }

    // Try partial match on category name
    const partialMatch = VALID_CATEGORIES.find(c =>
        c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase())
    );
    if (partialMatch) {
        return partialMatch;
    }

    // Try keyword match
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw) || kw.includes(lower))) {
            return category;
        }
    }

    return null;
}

/**
 * Match user input to a valid role
 * Supports:
 * - Exact match
 * - Partial match (e.g., "ed" → "editor")
 */
export function matchRole(input: string): typeof VALID_ROLES[number] | null {
    const lower = input.toLowerCase().trim();

    // Try exact match
    const exactMatch = VALID_ROLES.find(r => r === lower);
    if (exactMatch) {
        return exactMatch;
    }

    // Try partial match
    const partialMatch = VALID_ROLES.find(r =>
        r.startsWith(lower) || lower.startsWith(r)
    );
    if (partialMatch) {
        return partialMatch;
    }

    return null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
    const trimmed = email.trim();

    // Basic email validation
    if (!trimmed.includes('@')) {
        return false;
    }

    if (!trimmed.includes('.')) {
        return false;
    }

    // Check for valid structure: something@something.something
    const parts = trimmed.split('@');
    if (parts.length !== 2) {
        return false;
    }

    const [local, domain] = parts;
    if (!local || !domain) {
        return false;
    }

    if (!domain.includes('.')) {
        return false;
    }

    return true;
}

/**
 * Format category list for display
 */
export function formatCategoryList(): string {
    const categoryDisplay = {
        'file': '📁 Files',
        'appointment': '📅 Appointments',
        'project': '🚀 Projects',
        'customer': '👥 Customers',
        'expense': '💰 Expenses',
        'task': '✅ Tasks',
        'Miscellaneous': '📦 Miscellaneous'
    };
    return VALID_CATEGORIES.map((cat, i) => `${i + 1}. ${categoryDisplay[cat]}`).join('\n');
}

/**
 * Format role list for display
 */
export function formatRoleList(): string {
    const roleDescriptions = {
        owner: '🟣 **owner** - Full system control',
        admin: '🔴 **admin** - Manage users & resources',
        editor: '🔵 **editor** - Create & edit resources',
        viewer: '⚪ **viewer** - Read-only access'
    };

    return VALID_ROLES.map(role => roleDescriptions[role]).join('\n');
}
