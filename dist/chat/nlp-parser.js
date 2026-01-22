import pool from '../database.js';
// ============================================
// COMPREHENSIVE PATTERN MATCHING
// ============================================
const INTENT_PATTERNS = {
    // ==================== SOCIAL INTENTS ====================
    greeting: [
        /^(hi|hello|hey|yo|sup|wassup|what'?s up|greetings|hiya|howdy)\b/i,
        /^good (morning|afternoon|evening|day)/i,
        /^hel+o+\b/i,
        /^hay+\b/i,
    ],
    goodbye: [
        /^(bye|goodbye|see you|see ya|later|catch you later|peace|cya|adios|farewell)\b/i,
        /^good(bye| bye)\b/i,
        /^take care\b/i,
        /^bye bye\b/i,
    ],
    gratitude: [
        /^(thanks|thank you|thx|ty|appreciate|appreciated)\b/i,
        /\b(thanks|thank you|thx)\b/i,
        /^much appreciated\b/i,
        /^(cheers|kudos)\b/i,
    ],
    compliment: [
        /^(good job|great|awesome|amazing|excellent|perfect|nice|cool|well done|fantastic)\b/i,
        /\b(you'?re|you are) (great|awesome|amazing|helpful|good|the best)\b/i,
        /^love (it|this|you)\b/i,
        /^(nailed it|killed it|crushed it)\b/i,
    ],
    casual_question: [
        /^how (are you|r u|are ya|you doing)\b/i,
        /^what'?s (up|new|going on|happening|good)\b/i,
        /^you (good|ok|okay|alright)\b/i,
        /^how'?s it going\b/i,
    ],
    small_talk: [
        /^(tell me about yourself|who are you|what are you)\b/i,
        /^what can you do\b/i,
        /^what do you do\b/i,
        /^introduce yourself\b/i,
    ],
    // ==================== HELP INTENTS ====================
    help: [
        /^help\b/i,
        /^commands?\b/i,
        /^what (can|do) (i|you)/i,
        /^show (me )?(all )?commands?\b/i,
        /^menu\b/i,
        /^options?\b/i,
    ],
    // ==================== USER MANAGEMENT ====================
    find_user: [
        /^(find|search|locate|look for) (user |person |account )?(.+)/i,
        /^do (you|we) have (a )?(user|person|account) (named|called) (.+)/i,
        /^is there (a )?(user|person|account) (.+)/i,
    ],
    get_user_info: [
        /^(who is|who's|whois) (.+)/i,
        /^(show|get|tell me|display) (details?|info|information) (about|for|of) (user |person |account )?(.+)/i,
        /^(tell me about|info about|show me|give me info on) (user )?(.+)/i,
        /^what (is |are )?(the )?role(s)? (of|for|is) (.+)/i,
        /^what role is (.+?) serving (as|in)/i,
        /^what (role|permissions?) does (.+) have\b/i,
        /^(.+)'?s (role|info|details|information)\b/i,
        /^(give|show) (me )?(details|info|information) (about|for|on) (.+)/i,
    ],
    change_role: [
        /^(change|update|set|modify) (.+?)(?:'?s)? role (to|as) (owner|admin|editor|viewer)\b/i,
        /^(change|update|convert|switch) (.+?) from (an? )?(owner|admin|editor|viewer) to (an? )?(owner|admin|editor|viewer)\b/i,
        /^(make|promote|demote|assign) (.+?) (an? )?(owner|admin|editor|viewer)\b/i,
        /^(.+?) (should be|needs to be|must be) (an? )?(owner|admin|editor|viewer)\b/i,
        /^give (.+?) (owner|admin|editor|viewer) (role|access|permissions?)\b/i,
        /^(promote|upgrade) (.+?) to (owner|admin|editor|viewer)\b/i,
        /^(demote|downgrade) (.+?) to (owner|admin|editor|viewer)\b/i,
    ],
    create_user: [
        /^(create|add|register|new|make) (a |an )?(user|account|person)\b/i,
        /^(create|add|register) (.+?) (with|using) email (.+?) as (owner|admin|editor|viewer)\b/i,
    ],
    delete_user: [
        /^(delete|remove|erase|kick|ban|terminate|drop) (the )?(user|account|person) (.+)/i,
        /^(delete|remove|erase|kick|ban|terminate|drop) (.+) (user|account|person)$/i,
        /^(kick out|boot) (.+)/i,
    ],
    list_users: [
        /^(list|show|get|display|who are) (all |the )?(users?|people|accounts?|members?)$/i,
        /^(list|show|get|display|who are) (all |the )?(owners?|admins?|editors?|viewers?)$/i,
        /^(show|list|get) (me )?(all |the )?(owners?|admins?|editors?|viewers?)$/i,
        /^who (are|is) (all |the )?(owners?|admins?|editors?|viewers?)$/i,
        /^(give|show) me (a )?list of (all |the )?(owners?|admins?|editors?|viewers?|users?)$/i,
    ],
    // ==================== RESOURCE MANAGEMENT ====================
    list_resources: [
        /^(show|list|display|get) (all |the )?(resources?|files?|documents?)\b/i,
        /^(what|which) (resources?|files?|documents?) (do we have|are there|exist)\b/i,
        /^resources? list\b/i,
    ],
    list_categories: [
        /^(show|display|list|view|what are|get|see) (all |the )?(available )?(categories|category|options)\b/i,
        /^categories$/i,
        /^what categories\b/i,
    ],
    check_access: [
        /^(who|which users?) (has|have|can) access (to |the )?(.+)/i,
        /^(show|list|tell me|get) (users?|people) (who|that) (can )?(access|view|see|read) (.+)/i,
        /^who can (access|view|see|read) (.+)/i,
        /^what (files?|resources?|documents?) (does|can) (.+?) (access|view|see)\b/i,
    ],
    create_resource: [
        /^(create|add|make) (a |an )?(new )?(file|document|resource) (named?|called?) (.+)/i,
        /^(create|add|make) (a |an )?(new )?(file|document|resource) (.+)/i,
        /^(create|add) (.+?) in (category |type )?(.+)/i,
    ],
    delete_resource: [
        /^(delete|remove|drop|erase) (the |a )?(file|document|resource|appointment|expense|project|task|customer) (.+)/i,
        /^(delete|remove|drop|erase) (.+)\.(pdf|txt|xlsx|docx|csv|jpg|png|gif|jpeg|doc|xls|ppt|pptx)$/i,
    ],
    update_visibility: [
        /^(make|set) (.+?) (visible|accessible) (to|for) (owners?|admins?|editors?|viewers?)\b/i,
        /^(hide|restrict|block) (.+?) (from|for) (owners?|admins?|editors?|viewers?)\b/i,
        /^(grant|give|allow|revoke|remove|deny) (owner|admin|editor|viewer) access (to|for) (.+)/i,
        /^(share) (.+?) (with) (owners?|admins?|editors?|viewers?)\b/i,
        /^(give) (owners?|admins?|editors?|viewers?) access (to) (.+)/i,
    ],
    bulk_visibility: [
        /^(make|set) all (files?|resources?|documents?) in (.+?) (visible|accessible) (to|for) (owners?|admins?|editors?|viewers?)\b/i,
        /^(hide|restrict) all (files?|resources?|documents?) in (.+?) (from) (owners?|admins?|editors?|viewers?)\b/i,
        /^(share) all (files?|resources?|documents?) (in (.+?) )?(with) (owners?|admins?|editors?|viewers?)\b/i,
    ],
    category_stats: [
        /^(how many|count) (files?|resources?|documents?) (in|for) (.+)/i,
        /^(show|list|display) empty categories/i,
        /^which category has (the )?(most|least) (files?|resources?)/i,
        /^(what|which) category (is|has) (the )?(biggest|largest|smallest)/i,
    ],
    // ==================== ENHANCED USER QUERIES ====================
    user_creation_date: [
        /^(when|since when) (was|is|did) (.+?) (added|created|registered|made|join|joined)\b/i,
        /^(what|tell me) (date|time) (was|did) .+ (added|created|registered|join|joined)\b/i,
        /^(.+?) (creation|registration|join) (date|time)\b/i,
        /^when did (.+?) (join|get added|get created)\b/i,
    ],
    user_full_details: [
        /^(give|show|get|tell|display) (me )?(entire|complete|full|all) (details?|info|information) (of|about|for) (.+)/i,
        /^(everything|all) about (.+)/i,
        /^(.+?)(?:'s)? (complete|full|entire) (profile|details?|info)\b/i,
    ],
    user_creator: [
        /^who (created|added|registered|made|invited) (.+)/i,
        /^who added (.+?) (to|into) (the )?(system|database)\b/i,
        /^(.+?) (was )?(created|added|registered|invited) by (who|whom)\b/i,
        /^(show|tell) (me )?who (created|added|invited) (.+)/i,
    ],
    user_last_active: [
        /^when (was|is) (.+?) (last )?(active|online|logged in|seen)\b/i,
        /^(.+?)(?:'s)? (last )?(login|activity|session)\b/i,
    ],
    user_history: [
        /^(show|get|display|tell) (me )?(.+?)(?:'s)? (history|changes|activity|log|audit)\b/i,
        /^(what|which) (changes|actions|activities) (has|did) (.+?) (made|done|performed)\b/i,
    ],
    user_created_resources: [
        /^(what|which) (resources?|files?|documents?) (did|has) (.+?) (create|created|made|add|added)\b/i,
        /^(show|list|get) (resources?|files?) (created|made|added) by (.+)/i,
        /^(.+?)(?:'s)? (created )?(resources?|files?|documents?)\b/i,
    ],
    user_password_status: [
        /^(has|did) (.+?) (changed?|updated?) (their|his|her) password\b/i,
        /^(does|is) (.+?) (need to|have to|must) change password\b/i,
    ],
    // ==================== ENHANCED RESOURCE QUERIES ====================
    resource_creation_date: [
        /^when (was|is) (.+?) (created|added|uploaded|made)\b/i,
        /^(creation|upload) (date|time) (of|for) (.+)/i,
    ],
    resource_creator: [
        /^who (created|added|uploaded|made) (.+)/i,
        /^(.+?) (was )?(created|added|uploaded) by (who|whom)\b/i,
    ],
    // ==================== FILTERED LISTS ====================
    list_inactive_users: [
        /^(show|list|get|display) (all )?(inactive|disabled|deactivated) (users?|accounts?)\b/i,
    ],
    list_users_need_password_change: [
        /^(show|list|get) (users?|accounts?|people) (who|that) (need|must|have) to change (their )?password/i,
    ],
    // ==================== SYSTEM INFORMATION ====================
    system_stats: [
        /^(show|get|display|tell me) (system |the )?(stats|statistics|info|information)\b/i,
        /^(how many|count) (users?|resources?|files?|accounts?|people)\b/i,
        /^(system |server )?(status|health|stats|info)\b/i,
        /^(overview|summary|report)\b/i,
    ],
    who_am_i: [
        /^(who am i|my (role|info|details|information)|what'?s my (role|permissions?))\b/i,
        /^(show|tell) me (about )?(my|me)\b/i,
    ],
};
// ============================================
// RESPONSE TEMPLATES
// ============================================
export const RESPONSE_TEMPLATES = {
    greeting: [
        "👋 Hey there! I'm your admin assistant. Type 'help' to see what I can do!",
        "💬 Hello! Ready to manage some users and resources? Ask me anything!",
        "🔥 What's up! I'm here to help with all your admin needs.",
        "⚡ Greetings, admin! Let's get some work done. Need help?",
    ],
    goodbye: [
        "👋 See you later! Stay awesome!",
        "💬 Catch you later! Hit me up anytime.",
        "🔥 Peace out! I'll be here when you need me.",
        "⚡ Later! Keep those systems running smooth!",
    ],
    gratitude: [
        "💪 No problem! Happy to help!",
        "🎉 Anytime! That's what I'm here for!",
        "✅ You're welcome! Let me know if you need anything else.",
        "🔥 Glad I could help! Just holler if you need more.",
    ],
    compliment: [
        "🎉 Thanks! I try my best to keep things running smooth!",
        "💪 Appreciate it! Just doing my job!",
        "🔥 You're awesome too! Let's keep crushing it!",
        "⚡ Thanks! Teamwork makes the dream work!",
    ],
    casual_question: [
        "🤖 I'm doing great! Just here monitoring the systems. How can I help you?",
        "💪 All systems operational! Ready to help you manage users and resources!",
        "🔥 Running smooth! What do you need help with today?",
    ],
    small_talk: [
        "🤖 I'm ADMIN_AI, your friendly admin assistant! I help you manage users, resources, and access control. I can:\n\n" +
            "👥 Manage users (roles, creation, deletion)\n" +
            "📁 Manage resources (access, visibility)\n" +
            "📊 Show system stats\n" +
            "💬 Chat naturally - just ask!\n\n" +
            "Type 'help' for all commands!",
    ],
    help: `💬 **ADMIN ASSISTANT - COMMAND CENTER**

**👥 USER MANAGEMENT:**
• "Show all viewers" - List users by role
• "Who is jose" - Find user info
• "Change john to editor" - Update roles
• "Create user alice with email alice@test.com as editor"
• "Delete user bob"

**📁 RESOURCE MANAGEMENT:**
• "Who has access to Report.pdf?" - Check file access
• "What files does jose have access to?" - User's files
• "Make Budget.xlsx visible to viewers"
• "Hide Secrets.doc from editors"
• "Create resource Project.xlsx in Data Sources"
• "Delete resource OldFile.pdf"

**📊 SYSTEM INFO:**
• "Show system stats" - User/resource counts
• "What's my role?" - Your current role
• "Show details for john" - User information

**💬 CASUAL CHAT:**
• Ask me anything naturally!
• I understand: hi, thanks, good job, what's up
• Just type like you're talking to a friend!

**PRO TIPS:**
✨ Use natural language - I'm smart!
✨ Don't worry about exact phrasing
✨ I'll help you if I'm confused
✨ Say 'yo' or 'hey' - I'm chill!

Type any command to get started! 🚀`,
};
// ============================================
// FALLBACK RESPONSES
// ============================================
export const FALLBACK_RESPONSES = {
    user_not_found: (name, suggestions) => {
        if (suggestions.length > 0) {
            return `❌ Hmm, I couldn't find '${name}'. Did you mean: ${suggestions.join(', ')}?`;
        }
        return `❌ User '${name}' not found. Try "show all users" to see who's in the system.`;
    },
    resource_not_found: (name, suggestions) => {
        if (suggestions.length > 0) {
            return `❌ Couldn't find '${name}'. Did you mean: ${suggestions.join(', ')}?`;
        }
        return `❌ Resource '${name}' not found. Try "list all resources" to see what's available.`;
    },
    permission_denied: (action, required_role) => {
        return `❌ Sorry, you need ${required_role} permissions to ${action}. Your current role doesn't allow this.`;
    },
    invalid_role: (role) => {
        return `❌ '${role}' isn't a valid role. Valid roles are: owner, admin, editor, viewer.`;
    },
    unknown_intent: (message) => {
        const lower = message.toLowerCase();
        if (lower.includes('user') || lower.includes('person') || lower.includes('people')) {
            return `🤔 I think you're asking about users. Try:\n• "show all users"\n• "who is [name]"\n• "change [user] to [role]"`;
        }
        if (lower.includes('file') || lower.includes('resource') || lower.includes('document') || lower.includes('access')) {
            return `🤔 I think you're asking about files/resources. Try:\n• "who has access to [filename]"\n• "what files does [user] have access to"`;
        }
        if (lower.includes('role') || lower.includes('permission')) {
            return `🤔 I think you're asking about roles. Try:\n• "show all [role]s" (viewers, admins, etc.)\n• "change [user] to [role]"`;
        }
        return `🤔 I'm not sure what you mean. Type 'help' to see all available commands, or just ask me naturally!`;
    }
};
// ============================================
// HELPER FUNCTIONS
// ============================================
function normalizeRole(role) {
    const normalized = role.toLowerCase().trim();
    const roleMap = {
        'owner': 'owner',
        'admin': 'admin',
        'administrator': 'admin',
        'editor': 'editor',
        'viewer': 'viewer',
        'viewers': 'viewer',
        'editors': 'editor',
        'admins': 'admin',
        'owners': 'owner'
    };
    return roleMap[normalized] || null;
}
export async function findUserByIdentifier(identifier) {
    const normalized = identifier.toLowerCase().trim();
    try {
        const exactResult = await pool.query(`
      SELECT id, user_id, username, email, role, is_active, created_at
      FROM users
      WHERE LOWER(user_id) = $1 
         OR LOWER(username) = $1 
         OR LOWER(email) = $1
      LIMIT 1
    `, [normalized]);
        if (exactResult.rows.length > 0) {
            return exactResult.rows[0];
        }
        const partialResult = await pool.query(`
      SELECT id, user_id, username, email, role, is_active, created_at
      FROM users
      WHERE LOWER(username) LIKE $1 
         OR LOWER(email) LIKE $1
      LIMIT 1
    `, [`%${normalized}%`]);
        if (partialResult.rows.length > 0) {
            return partialResult.rows[0];
        }
        return null;
    }
    catch (error) {
        console.error('Error finding user:', error);
        return null;
    }
}
export async function findResourceByName(name) {
    const normalized = name.toLowerCase().trim();
    try {
        const result = await pool.query(`
      SELECT id, resource_type, data, 
             visible_to_owner, visible_to_admin, 
             visible_to_editor, visible_to_viewer,
             created_by, created_at
      FROM resources
      WHERE LOWER(data->>'name') LIKE $1
      LIMIT 1
    `, [`%${normalized}%`]);
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    }
    catch (error) {
        console.error('Error finding resource:', error);
        return null;
    }
}
export function getRandomResponse(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
}
// ============================================
// MAIN PARSER FUNCTION
// ============================================
/**
 * Sanitize user input before parsing
 */
function sanitizeInput(message) {
    return message
        .trim()
        .replace(/[?!.]+$/, '') // Remove trailing punctuation
        .replace(/\s+/g, ' '); // Normalize whitespace
}
// ============================================
// SMART ENTITY DETECTION
// ============================================
/**
 * Detect if a query is about a file/resource based on context clues
 * HIGHEST PRIORITY: File extensions are the strongest indicator
 */
function isResourceQuery(message) {
    const resourceIndicators = [
        // File extensions (strongest indicator)
        /\.(pdf|docx?|xlsx?|txt|csv|jpg|jpeg|png|gif|zip|rar|pptx?|md|json|xml|html|css|js|ts|py|java|cpp|h|sql|sh|bat)\b/i,
        // Resource-related keywords
        /\b(file|document|resource|report|spreadsheet|presentation|image|photo|video|folder)\b/i,
        // Path separators
        /[\/\\]/
    ];
    return resourceIndicators.some(pattern => pattern.test(message));
}
/**
 * Detect if a query is about a user based on context clues
 */
function isUserQuery(message) {
    const lower = message.toLowerCase();
    // If it's clearly a file, NOT a user
    if (isResourceQuery(message)) {
        return false;
    }
    const userIndicators = [
        /@[\w.-]+\.\w+/, // Email pattern
        /\b(user|person|account|member|profile)\b/i,
        /^who (is|am|are)\b/i,
        /\b(admin|editor|viewer|owner)\b/i // Role keywords
    ];
    return userIndicators.some(pattern => pattern.test(message));
}
/**
 * Intelligently detect the entity type based on context
 */
function detectEntityType(message) {
    const lower = message.toLowerCase();
    // FILE/RESOURCE DETECTION (highest priority)
    if (isResourceQuery(message)) {
        return 'resource';
    }
    // USER DETECTION
    if (isUserQuery(message)) {
        return 'user';
    }
    // SYSTEM DETECTION
    if (/\b(stats|statistics|system|health|status|help|commands)\b/i.test(lower)) {
        return 'system';
    }
    return 'unknown';
}
// ============================================
// AI-POWERED COMMAND PARSER (Using Groq)
// ============================================
import { parseCommandWithAI } from './ai-parser.js';
export async function parseCommand(message) {
    const sanitized = sanitizeInput(message);
    const msg = sanitized.trim();
    console.log('🧠 AI PARSING - Message:', msg);
    // Use AI to parse the command
    const result = await parseCommandWithAI(msg);
    console.log('🔍 Parsed intent:', result.intent);
    console.log('🔍 Entities:', JSON.stringify(result.entities));
    return {
        intent: result.intent,
        entities: result.entities,
        raw: msg,
        confidence: result.confidence
    };
}
/*
// ============================================
// OLD REGEX-BASED PARSER (BACKUP - DO NOT DELETE)
// ============================================
// This is kept as a fallback in case AI parsing has issues
// To revert: uncomment this code and comment out the AI version above

export async function parseCommand_OLD(message: string): Promise<ParsedCommand> {
    const sanitized = sanitizeInput(message);
    const msg = sanitized.trim();
    const lower = msg.toLowerCase();

    // ============================================
    // SMART CONTEXT-AWARE ROUTING
    // ============================================
    const entityType = detectEntityType(msg);
    console.log('🧠 SMART DETECTION - Message:', msg);
    console.log('🎯 Entity type detected:', entityType);

    // ... (rest of old code - 500+ lines)
    // Preserved for emergency rollback
}
*/
