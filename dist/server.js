import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { MCPHandler } from './mcp-handler.js';
import { initDatabase, seedUsers, getUsers, getUserRole, addUser, deleteUser } from './database.js';
import pool from './database.js';
import authRoutes from './auth/routes.js';
import { authenticateToken, requireRole } from './auth/middleware.js';
// ES Module __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
// Authentication routes (add BEFORE other routes)
app.use('/api/auth', authRoutes);
// Initialize MCP Handler
const mcpHandler = new MCPHandler();
// Groq AI (Free & Fast) - Optional
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_AI = !!GROQ_API_KEY;
if (USE_AI) {
    console.log('✅ Groq AI enabled');
}
else {
    console.log('ℹ️  Using pattern matching only (set GROQ_API_KEY in .env for AI features)');
}
const conversationHistory = new Map();
function addToHistory(userId, role, content) {
    if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
    }
    const history = conversationHistory.get(userId);
    history.push({ role, content, timestamp: Date.now() });
    // Keep only last 10 messages
    if (history.length > 10) {
        history.shift();
    }
}
function getHistory(userId) {
    return conversationHistory.get(userId) || [];
}
// ============================================
// FALLBACK PARSER - Simple Pattern Matching
// ============================================
function parseUserIntentFallback(userMessage, userId) {
    const msg = userMessage.toLowerCase().trim();
    // List patterns
    if (msg.match(/\b(show|list|get|view|display)\b.*\b(file|files)\b/)) {
        return { action: 'list', resourceType: 'file', userId };
    }
    if (msg.match(/\b(show|list|get|view|display)\b.*\b(appointment|appointments)\b/)) {
        return { action: 'list', resourceType: 'appointment', userId };
    }
    if (msg.match(/\b(show|list|get|view|display)\b.*\b(project|projects)\b/)) {
        return { action: 'list', resourceType: 'project', userId };
    }
    if (msg.match(/\b(show|list|get|view|display)\b.*\b(expense|expenses)\b/)) {
        return { action: 'list', resourceType: 'expense', userId };
    }
    if (msg.match(/\b(show|list|get|view|display)\b.*\b(task|tasks)\b/)) {
        return { action: 'list', resourceType: 'task', userId };
    }
    // Create patterns
    const createMatch = msg.match(/\b(create|add|new|make)\b.*\b(file|appointment|project|expense|task)\b.*?(?:called|named)?\s*[""']?([a-z0-9._-]+)[""']?/i);
    if (createMatch) {
        const resourceType = createMatch[2];
        const name = createMatch[3] || 'unnamed';
        return {
            action: 'create',
            resourceType,
            userId,
            data: { name }
        };
    }
    // Simple create without name
    if (msg.match(/\b(create|add|new|make)\b.*\b(file|files)\b/)) {
        return { action: 'create', resourceType: 'file', userId, data: { name: 'new-file.txt' } };
    }
    return null;
}
// ============================================
// INTENT PARSER - Groq AI with Pattern Matching Fallback
// ============================================
async function parseUserIntent(userMessage, userId) {
    console.log(`\n🔍 Parsing intent for: "${userMessage}"`);
    // Try AI first if enabled
    if (USE_AI) {
        try {
            // Build messages with conversation history for context
            const history = getHistory(userId);
            const messages = [
                {
                    role: 'system',
                    content: `You are a **command parser with conversation memory**.
Your job is to convert user messages into **structured JSON commands** for a Resource Manager system.

You do NOT talk like a human.
You do NOT explain.
You ONLY output valid JSON — nothing else.

====================
OUTPUT FORMAT
====================
{
  "action": "list | read | create | update | delete | meta | none",
  "resourceType": "file | appointment | project | expense | task | customer | user | access",
  "resourceId": "optional",
  "data": {},
  "filters": {}
}

====================
CORE RULES
====================
• Always respond with JSON ONLY  
• Never include text, comments, or explanations  
• Use conversation history to resolve follow-up questions  
• For follow-ups, prefer **list** over **read**  
• Never invent IDs or data  
• Be conservative — if unsure, return a safe intent  

====================
STANDARD COMMANDS
====================
"show my files"
→ {"action":"list","resourceType":"file"}

"do I have any xlsx files?"
→ {"action":"list","resourceType":"file","filters":{"file_type":"xlsx"}}

"show pdf files"
→ {"action":"list","resourceType":"file","filters":{"file_type":"pdf"}}

"list all excel files"
→ {"action":"list","resourceType":"file","filters":{"file_type":"xlsx"}}

"create file report.pdf"
→ {"action":"create","resourceType":"file","data":{"name":"report.pdf"}}

"delete expense 123"
→ {"action":"delete","resourceType":"expense","resourceId":"123"}

"delete files with name test.pdf"
"delete test.pdf"
→ {"action":"list","resourceType":"file","filters":{"name":"test.pdf"},"data":{"intent":"delete"}}

====================
FOLLOW-UP RULES
====================
• "when and where?" after appointments
→ {"action":"list","resourceType":"appointment"}

• "when?" after files
→ {"action":"list","resourceType":"file","filters":{"metadata":"time"}}

• "project title?" after projects
→ {"action":"list","resourceType":"project"}

• ANY follow-up referring to previously shown data
→ ALWAYS use "list"

====================
FILE TYPE RULE
====================
If user mentions file types (pdf, xlsx, docx, png, etc):
• Use filters.file_type
• NEVER use filters.type

====================
GREETINGS / SMALL TALK
====================
If the user says:
• "hi", "hello", "hey", "yo"

Return:
{"action":"meta","resourceType":"system","data":{"intent":"greeting"}}

====================
IDENTITY QUESTIONS
====================
"who are you?"
→ {"action":"meta","resourceType":"system","data":{"intent":"assistant_identity"}}

"what can you do?"
→ {"action":"meta","resourceType":"system","data":{"intent":"capabilities"}}

"who am I?"
→ {"action":"meta","resourceType":"system","data":{"intent":"user_identity"}}

====================
ACCESS / PERMISSION QUESTIONS
====================
"why can't I see this file?"
"why no access?"
"why is this hidden?"
"why cant I view appointments?"

→ {"action":"meta","resourceType":"system","data":{"intent":"permission_explanation"}}

====================
NO-DATA / AMBIGUOUS QUERIES
====================
If the message:
• Has no clear intent
• Is vague without context
• Is purely conversational without command meaning

Return:
{"action":"none"}

====================
ABSOLUTE CONSTRAINT
====================
Respond ONLY with valid JSON.
Never speak.
Never explain.
Never format.
Never add extra keys.`
                }
            ];
            // Add last 5 messages from history for context
            const recentHistory = history.slice(-5);
            recentHistory.forEach(msg => {
                messages.push({ role: msg.role, content: msg.content });
            });
            // Add current message
            messages.push({ role: 'user', content: userMessage });
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages,
                    temperature: 0.1,
                    max_tokens: 200
                })
            });
            if (response.ok) {
                const data = await response.json();
                const aiResponse = data.choices[0]?.message?.content || '';
                console.log(`🤖 Groq AI Response: ${aiResponse}`);
                const parsed = JSON.parse(aiResponse.trim());
                if (parsed.action && parsed.resourceType) {
                    const mcpRequest = {
                        action: parsed.action,
                        resourceType: parsed.resourceType,
                        userId,
                        resourceId: parsed.resourceId,
                        data: parsed.data,
                        filters: parsed.filters
                    };
                    console.log(`✅ Parsed with AI:`, JSON.stringify(mcpRequest, null, 2));
                    return mcpRequest;
                }
            }
        }
        catch (error) {
            console.log(`⚠️  AI parsing failed, falling back to pattern matching:`, error.message);
        }
    }
    // Fallback to pattern matching
    const result = parseUserIntentFallback(userMessage, userId);
    if (result) {
        console.log(`✅ Parsed with pattern matching:`, JSON.stringify(result, null, 2));
    }
    else {
        console.log(`❌ No pattern matched`);
    }
    return result;
}
// ============================================
// SMART RESPONSE GENERATION with Groq AI
// ============================================
async function generateNaturalResponse(userMessage, mcpResponse, request) {
    console.log(`📝 Generating smart response...`);
    // If AI is enabled, use it for smart formatting
    if (USE_AI && mcpResponse.success) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a smart, calm, human-like assistant living inside a **Resource Manager app**.
You help users understand their files, projects, and appointments — and why they can or cannot access things.

PERSONALITY
• Friendly, grounded, slightly techy
• Confident but not robotic
• Sounds like a helpful human, not an AI brochure
• Knows context (user role, permissions, past actions)

CORE RULES
1. Be casual and direct — no corporate or AI-sounding phrases
2. Keep responses SHORT and clear
3. Use bullet points (•) for lists
4. Use **bold** for key info
5. Never over-explain unless asked
6. Don't add extra suggestions or questions
7. For follow-ups, repeat info naturally (no "as mentioned before")
8. Stay in character as the app assistant — never break the illusion

GREETING BEHAVIOR
• If the user says "hi", "hello", "hey":
  - Respond warmly and briefly
  - Mention what you can help with

Examples:
"Hey 👋 Ready when you are."
"Hi. You can ask me about files, projects, or appointments."

IDENTITY QUESTIONS
If user asks **"Who are you?"**
Response style:
"I'm your **Resource Manager assistant**.
I help you see and manage what you're allowed to access."

If user asks **"What can you do?"**
• Files
• Appointments
• Projects
• Access & permissions

USER IDENTITY QUESTIONS
If user asks **"Who am I?"**
• State their name (if known)
• State their role clearly

Example:
"You're **Tharsan** — the **owner** of this workspace."

ACCESS / PERMISSION QUESTIONS
If user asks **"Why can't I see this file?"**, **"Why no access?"**, etc:
• Explain simply
• Mention role or permission reason
• Never blame the user

Examples:
"You don't have access because you're a **viewer**."
"This file is **owner-only**."

NEVER say:
• "Security reasons"
• "Policy"
• "I'm just an AI"
• Anything defensive or vague

UNKNOWN / EMPTY DATA
If there's no data:
"Looks like there's **nothing here yet**."

TONE CHECK
• Calm
• Clear
• Human
• Helpful
• Minimal

You are not a chatbot.
You are the interface.`
                        },
                        {
                            role: 'user',
                            content: `User asked: "${userMessage}"

Action performed: ${request.action} ${request.resourceType}

Result data: ${JSON.stringify(mcpResponse.data, null, 2)}

IMPORTANT RULES FOR FOLLOW-UP QUESTIONS:
• If user asks "time?" or "when?" → ONLY give the time/date
• If user asks "place?" or "where?" → ONLY give the location
• If user asks "status?" → ONLY give the status
• If user asks "title?" or "topic?" → ONLY give the title/name
• Be DIRECT and SPECIFIC - don't repeat everything

Examples:
User: "time?" (after seeing appointment)
Response: "**10:30 AM** on **Jan 15, 2025**"

User: "place?" (after seeing appointment)
Response: "**City Medical Center**"

User: "status?" (after seeing project)
Response: "**Active**"

User: "title?" (after seeing project)
Response: "**Website Redesign**"

Generate a natural, helpful response.`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                })
            });
            if (response.ok) {
                const data = await response.json();
                const aiResponse = data.choices[0]?.message?.content || '';
                console.log(`🤖 Smart response generated`);
                return aiResponse;
            }
        }
        catch (error) {
            console.log(`⚠️  AI response generation failed, using simple format:`, error.message);
        }
    }
    // Fallback to simple response
    if (mcpResponse.success) {
        return mcpResponse.message || 'Operation completed successfully!';
    }
    else {
        return mcpResponse.error || mcpResponse.message || 'An error occurred.';
    }
}
// Initialize database on startup
await initDatabase();
await seedUsers();
// ============================================
// ADMIN API - ADD USER
// ============================================
app.post('/api/admin/users', async (req, res) => {
    const { userId, username, email, name, role } = req.body;
    if (!userId || !role || !email || !username) {
        return res.status(400).json({ success: false, error: 'userId, username, email, and role required' });
    }
    try {
        // Add to database with email and name
        await addUser(userId, username, email, name || username, role);
        // Map role to OpenFGA relation
        const roleToRelation = {
            'viewer': 'viewer',
            'editor': 'editor',
            'admin': 'owner' // Map admin role to owner relation in OpenFGA
        };
        const relation = roleToRelation[role] || role;
        // Grant OpenFGA permissions based on role
        const allResourceTypes = ['file', 'appointment', 'project', 'expense', 'task', 'customer'];
        // Viewers get NO default access, editors and admins get all
        const resourceTypes = role === 'viewer' ? [] : allResourceTypes;
        const writes = resourceTypes.map(type => ({
            user: userId,
            relation: relation,
            object: `resource:${type}_*`
        }));
        // Only call OpenFGA if there are tuples to write
        if (writes.length > 0) {
            const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ writes: { tuple_keys: writes } })
            });
            if (!response.ok) {
                const error = await response.json();
                // Rollback database insert if OpenFGA fails
                await deleteUser(userId);
                return res.json({ success: false, error: error.message || 'Failed to create user' });
            }
        }
        console.log(`✅ Created user: ${username} (${email}) with role: ${role} (OpenFGA relation: ${relation}, resources: ${resourceTypes.join(', ') || 'none'})`);
        return res.json({ success: true, message: `User ${username} created with ${role} permissions` });
    }
    catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// ADMIN API - LIST USERS
// ============================================
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await getUsers();
        return res.json({
            success: true,
            data: users
        });
    }
    catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// ADMIN API - DELETE USER
// ============================================
app.delete('/api/admin/users/:userId', async (req, res) => {
    const userId = decodeURIComponent(req.params.userId);
    try {
        // Delete from database first (includes protection for default users)
        await deleteUser(userId);
        // Delete ALL OpenFGA tuples for this user
        const resourceTypes = ['file', 'appointment', 'project', 'expense', 'task', 'customer'];
        const allRelations = ['viewer', 'editor', 'owner']; // All OpenFGA relations
        // Build all tuple deletions
        const tuplesToDelete = [];
        for (const resourceType of resourceTypes) {
            for (const relation of allRelations) {
                tuplesToDelete.push({
                    user: userId,
                    relation: relation,
                    object: `resource:${resourceType}_*`
                });
            }
        }
        // Delete all tuples in one API call
        const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deletes: { tuple_keys: tuplesToDelete }
            })
        });
        if (!response.ok) {
            console.warn('Warning: Failed to delete some OpenFGA tuples');
        }
        console.log(`✅ Deleted user and all tuples: ${userId}`);
        return res.json({ success: true, message: `User ${userId} deleted and permissions revoked` });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// USER API - GET ROLE
// ============================================
app.get('/api/user/role', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
    }
    try {
        const role = await getUserRole(userId);
        if (!role) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json({ success: true, role });
    }
    catch (error) {
        console.error('Error fetching user role:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// ADMIN API - CHANGE USER ROLE
// ============================================
app.patch('/api/admin/users/:userId/role', async (req, res) => {
    const userId = decodeURIComponent(req.params.userId);
    const { newRole } = req.body;
    if (!newRole || !['viewer', 'editor', 'admin'].includes(newRole)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    try {
        // Get current role
        const currentRole = await getUserRole(userId);
        if (!currentRole) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (currentRole === newRole) {
            return res.json({ success: true, message: 'Role unchanged' });
        }
        // Map role to OpenFGA relation
        const roleToRelation = {
            'viewer': 'viewer',
            'editor': 'editor',
            'admin': 'owner'
        };
        const oldRelation = roleToRelation[currentRole];
        const newRelation = roleToRelation[newRole];
        // Delete old wildcard tuples and create new ones
        const allResourceTypes = ['file', 'appointment', 'project', 'expense', 'task', 'customer'];
        // Determine resource types for old and new roles
        const oldResourceTypes = currentRole === 'viewer' ? [] : allResourceTypes;
        const newResourceTypes = newRole === 'viewer' ? [] : allResourceTypes;
        const deleteTuples = oldResourceTypes.map(type => ({
            user: userId,
            relation: oldRelation,
            object: `resource:${type}_*`
        }));
        const createTuples = newResourceTypes.map(type => ({
            user: userId,
            relation: newRelation,
            object: `resource:${type}_*`
        }));
        // Only call OpenFGA if there are tuples to write or delete
        if (createTuples.length > 0 || deleteTuples.length > 0) {
            const requestBody = {};
            if (createTuples.length > 0) {
                requestBody.writes = { tuple_keys: createTuples };
            }
            if (deleteTuples.length > 0) {
                requestBody.deletes = { tuple_keys: deleteTuples };
            }
            const response = await fetch(`${process.env.FGA_API_URL}/stores/${process.env.FGA_STORE_ID}/write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const error = await response.json();
                return res.json({ success: false, error: error.message || 'Failed to update role' });
            }
        }
        // Update database
        await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2', [newRole, userId]);
        console.log(`✅ Changed ${userId} role: ${currentRole} → ${newRole} (OpenFGA: ${oldRelation} → ${newRelation}, resources: ${newResourceTypes.join(', ') || 'none'})`);
        return res.json({ success: true, message: `Role updated to ${newRole}` });
    }
    catch (error) {
        console.error('Error changing user role:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// SERVE ADMIN PANEL
// ============================================
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});
// ============================================
// RESOURCES API - CREATE RESOURCE
// ============================================
app.post('/api/resources', authenticateToken, async (req, res) => {
    const { resource_type, data, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer } = req.body;
    // Only admin/editor can create resources
    if (req.user.role !== 'owner' && req.user.role !== 'admin' && req.user.role !== 'editor') {
        return res.status(403).json({ success: false, error: 'Unauthorized: Only admin and editor can create resources' });
    }
    // Validate required fields
    if (!resource_type || !data) {
        return res.status(400).json({ success: false, error: 'resource_type and data are required' });
    }
    try {
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
            resource_type,
            JSON.stringify(data),
            visible_to_owner !== false, // Default true
            visible_to_admin !== false, // Default true
            visible_to_editor !== false, // Default true
            visible_to_viewer !== false, // Default true
            req.user.user_id // Add created_by from authenticated user
        ]);
        const newResource = result.rows[0];
        console.log(`✅ Resource created: ${data.name || resource_type} (${resource_type}) by ${req.user.username}`);
        return res.json({
            success: true,
            resource: newResource,
            message: 'Resource created successfully'
        });
    }
    catch (error) {
        console.error('❌ Error creating resource:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create resource',
            details: error.message
        });
    }
});
// Delete resource (admin only)
app.delete('/api/resources/:id', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM resources WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Resource not found' });
        }
        const deletedResource = result.rows[0];
        console.log(`✅ Resource deleted: ${deletedResource.data?.name || id} by ${req.user.username}`);
        res.json({ success: true, message: 'Resource deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting resource:', error);
        res.status(500).json({ success: false, error: 'Failed to delete resource' });
    }
});
// ============================================
// RESOURCES API - GET ALL RESOURCES
// ============================================
app.get('/api/resources', authenticateToken, async (req, res) => {
    const { type } = req.query;
    const userRole = req.user.role;
    try {
        let query = 'SELECT * FROM resources WHERE 1=1';
        const params = [];
        // Filter by resource type
        if (type) {
            params.push(type);
            query += ` AND resource_type = $${params.length}`;
        }
        // Filter by visibility based on user role (except owner/admin who see all)
        if (userRole !== 'owner' && userRole !== 'admin') {
            const visibilityColumn = `visible_to_${userRole}`;
            query += ` AND ${visibilityColumn} = true`;
        }
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);
        // Get all users with wildcard permissions
        const users = await getUsers();
        const wildcardAccess = users.map(u => ({
            user_id: u.user_id,
            username: u.username,
            role: u.role
        }));
        return res.json({
            success: true,
            data: result.rows,
            wildcardAccess // Show who has wildcard access
        });
    }
    catch (error) {
        console.error('Error fetching resources:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// UPDATE RESOURCE VISIBILITY
// ============================================
app.post('/api/admin/update-visibility', authenticateToken, async (req, res) => {
    const { resourceId, role, isVisible } = req.body;
    // Only admin/owner can update visibility
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    try {
        const validRoles = ['owner', 'admin', 'editor', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid role' });
        }
        const column = `visible_to_${role}`;
        await pool.query(`UPDATE resources SET ${column} = $1 WHERE id = $2`, [isVisible, resourceId]);
        console.log(`✅ Updated visibility: ${resourceId} - ${role} = ${isVisible}`);
        return res.json({ success: true, resourceId, role, isVisible });
    }
    catch (error) {
        console.error('Error updating visibility:', error);
        return res.status(500).json({ success: false, error: 'Failed to update visibility' });
    }
});
// ============================================
// API ENDPOINTS
// ============================================
// ============================================
// ADMIN MANAGEMENT - GRANT/REVOKE ADMIN ACCESS
// ============================================
// Grant admin access (owner only)
app.post('/api/admin/grant-admin', authenticateToken, requireRole(['owner']), async (req, res) => {
    const { userId, reason } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Get current user info
        const userResult = await client.query('SELECT id, role, username FROM users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const targetUser = userResult.rows[0];
        const previousRole = targetUser.role;
        if (previousRole === 'owner') {
            throw new Error('Cannot modify owner role');
        }
        // Update user role to admin
        await client.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', ['admin', userId]);
        // Log the grant in admin_grants table
        await client.query(`
            INSERT INTO admin_grants (user_id, granted_by, action, previous_role, new_role, reason)
            VALUES ($1, $2, 'granted', $3, 'admin', $4)
        `, [targetUser.id, req.user.id, previousRole, reason]);
        await client.query('COMMIT');
        console.log(`✅ Admin access granted to ${targetUser.username} by ${req.user.username}`);
        res.json({
            success: true,
            message: `Admin access granted to ${targetUser.username}`
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error granting admin:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to grant admin access'
        });
    }
    finally {
        client.release();
    }
});
// Revoke admin access (owner only)
app.post('/api/admin/revoke-admin', authenticateToken, requireRole(['owner']), async (req, res) => {
    const { userId, newRole, reason } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Validate new role
        if (!['editor', 'viewer'].includes(newRole)) {
            throw new Error('Invalid role. Must be editor or viewer');
        }
        // Get current user info
        const userResult = await client.query('SELECT id, role, username FROM users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const targetUser = userResult.rows[0];
        const previousRole = targetUser.role;
        if (previousRole === 'owner') {
            throw new Error('Cannot modify owner role');
        }
        // Update user role
        await client.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [newRole, userId]);
        // Log the revocation in admin_grants table
        await client.query(`
            INSERT INTO admin_grants (user_id, granted_by, action, previous_role, new_role, reason)
            VALUES ($1, $2, 'revoked', $3, $4, $5)
        `, [targetUser.id, req.user.id, previousRole, newRole, reason]);
        await client.query('COMMIT');
        console.log(`✅ Admin access revoked from ${targetUser.username} by ${req.user.username}, new role: ${newRole}`);
        res.json({
            success: true,
            message: `Admin access revoked from ${targetUser.username}`
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error revoking admin:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to revoke admin access'
        });
    }
    finally {
        client.release();
    }
});
// Get admin grant history (owner only)
app.get('/api/admin/grant-history', authenticateToken, requireRole(['owner']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ag.id,
                ag.action,
                u.username as target_user,
                gb.username as granted_by_user,
                ag.previous_role,
                ag.new_role,
                ag.reason,
                ag.created_at
            FROM admin_grants ag
            JOIN users u ON ag.user_id = u.id
            JOIN users gb ON ag.granted_by = gb.id
            ORDER BY ag.created_at DESC
            LIMIT 50
        `);
        res.json({ success: true, history: result.rows });
    }
    catch (error) {
        console.error('Error fetching grant history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch grant history' });
    }
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    const { message, userId } = req.body;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📨 New chat message from ${userId}: "${message}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    // Validate input
    if (!message || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Message and userId are required'
        });
    }
    try {
        // Step 1: Parse user intent with Groq AI or pattern matching
        const mcpRequest = await parseUserIntent(message, userId);
        if (!mcpRequest) {
            return res.json({
                success: false,
                message: "I didn't quite understand that. Try asking me to show, create, update, or delete files, appointments, projects, or other resources."
            });
        }
        // RESTRICT APPOINTMENTS TO ADMIN/OWNER ONLY
        if (mcpRequest.resourceType === 'appointment') {
            // Get user role from database
            const userResult = await pool.query('SELECT role FROM users WHERE user_id = $1', [userId]);
            if (userResult.rows.length === 0 ||
                (userResult.rows[0].role !== 'owner' && userResult.rows[0].role !== 'admin')) {
                return res.json({
                    success: false,
                    response: 'Access denied. Appointments are only accessible to administrators.',
                    message: 'Access denied. Appointments are only accessible to administrators.'
                });
            }
        }
        // Handle meta actions (greetings, identity, etc.)
        if (mcpRequest.action === 'meta') {
            const intent = mcpRequest.data?.intent;
            let response = '';
            if (intent === 'greeting') {
                response = 'Hey 👋 Ready when you are.';
            }
            else if (intent === 'assistant_identity') {
                response = "I'm your **Resource Manager assistant**.\nI help you see and manage what you're allowed to access.";
            }
            else if (intent === 'capabilities') {
                response = "I can help you with:\n• Files\n• Appointments\n• Projects\n• Access & permissions";
            }
            else if (intent === 'user_identity') {
                // Extract user name from userId (e.g., "user:tharsan" -> "Tharsan")
                const userName = userId.split(':')[1];
                const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);
                response = `You're **${capitalizedName}**.`;
            }
            else if (intent === 'permission_explanation') {
                // Extract user name and role
                const userName = userId.split(':')[1];
                const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);
                // Simple role detection (you can enhance this)
                const isOwner = userName.toLowerCase() === 'tharsan';
                const role = isOwner ? 'owner' : 'viewer';
                if (isOwner) {
                    response = `You're the **owner** — you have full access to everything.`;
                }
                else {
                    response = `You're a **${role}** — you can only view certain resources.\nYou don't have permission to see appointments.`;
                }
            }
            addToHistory(userId, 'user', message);
            addToHistory(userId, 'assistant', response);
            return res.json({
                success: true,
                message: response
            });
        }
        // Handle none action (ambiguous/unclear)
        if (mcpRequest.action === 'none') {
            const response = "Not sure what you mean. Try asking about files, projects, or appointments.";
            addToHistory(userId, 'user', message);
            addToHistory(userId, 'assistant', response);
            return res.json({
                success: true,
                message: response
            });
        }
        // Handle list with delete intent (e.g., "delete files with name test.pdf")
        if (mcpRequest.action === 'list' && mcpRequest.data?.intent === 'delete') {
            // First, get the list of files
            const listResponse = await mcpHandler.handle(mcpRequest);
            if (!listResponse.success || !listResponse.data || listResponse.data.length === 0) {
                const response = "No files found with that name.";
                addToHistory(userId, 'user', message);
                addToHistory(userId, 'assistant', response);
                return res.json({
                    success: false,
                    message: response
                });
            }
            // Delete each file found
            const deleteResults = [];
            for (const item of listResponse.data) {
                const deleteRequest = {
                    action: 'delete',
                    resourceType: mcpRequest.resourceType,
                    resourceId: item.id,
                    userId
                };
                const deleteResponse = await mcpHandler.handle(deleteRequest);
                deleteResults.push(deleteResponse);
            }
            const deletedCount = deleteResults.filter(r => r.success).length;
            const response = `Deleted **${deletedCount}** file(s) named **${mcpRequest.filters?.name}**.`;
            addToHistory(userId, 'user', message);
            addToHistory(userId, 'assistant', response);
            return res.json({
                success: true,
                message: response
            });
        }
        // Step 2: Execute the request through MCP Handler
        const mcpResponse = await mcpHandler.handle(mcpRequest);
        // Step 3: Generate smart AI response
        const naturalResponse = await generateNaturalResponse(message, mcpResponse, mcpRequest);
        // Step 4: Save to conversation history
        addToHistory(userId, 'user', message);
        addToHistory(userId, 'assistant', naturalResponse);
        // Step 5: Return combined response
        return res.json({
            success: mcpResponse.success,
            message: naturalResponse,
            data: mcpResponse.data,
            raw: mcpResponse // Include raw response for debugging
        });
    }
    catch (error) {
        console.error(`❌ Error processing chat:`, error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred processing your request',
            message: 'Sorry, something went wrong. Please try again.'
        });
    }
});
// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});
// ============================================
// SERVER STARTUP
// ============================================
app.listen(PORT, () => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 MCP Resource Manager Server`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Pattern Matching: Enabled`);
    console.log(`✅ OpenFGA Store: ${process.env.FGA_STORE_ID}`);
    console.log(`📁 Static files: public/`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mcpHandler.close();
    process.exit(0);
});
