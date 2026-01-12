import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { MCPHandler, MCPRequest } from './mcp-handler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize MCP Handler
const mcpHandler = new MCPHandler();

// Groq AI (Free & Fast) - Optional
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_AI = !!GROQ_API_KEY;

if (USE_AI) {
    console.log('✅ Groq AI enabled');
} else {
    console.log('ℹ️  Using pattern matching only (set GROQ_API_KEY in .env for AI features)');
}

// Conversation Memory - Store last 10 messages per user
interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const conversationHistory = new Map<string, ConversationMessage[]>();

function addToHistory(userId: string, role: 'user' | 'assistant', content: string) {
    if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
    }
    const history = conversationHistory.get(userId)!;
    history.push({ role, content, timestamp: Date.now() });

    // Keep only last 10 messages
    if (history.length > 10) {
        history.shift();
    }
}

function getHistory(userId: string): ConversationMessage[] {
    return conversationHistory.get(userId) || [];
}

// ============================================
// FALLBACK PARSER - Simple Pattern Matching
// ============================================

function parseUserIntentFallback(userMessage: string, userId: string): MCPRequest | null {
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

async function parseUserIntent(userMessage: string, userId: string): Promise<MCPRequest | null> {
    console.log(`\n🔍 Parsing intent for: "${userMessage}"`);

    // Try AI first if enabled
    if (USE_AI) {
        try {
            // Build messages with conversation history for context
            const history = getHistory(userId);
            const messages: any[] = [
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
                    const mcpRequest: MCPRequest = {
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
        } catch (error: any) {
            console.log(`⚠️  AI parsing failed, falling back to pattern matching:`, error.message);
        }
    }

    // Fallback to pattern matching
    const result = parseUserIntentFallback(userMessage, userId);

    if (result) {
        console.log(`✅ Parsed with pattern matching:`, JSON.stringify(result, null, 2));
    } else {
        console.log(`❌ No pattern matched`);
    }

    return result;
}

// ============================================
// SMART RESPONSE GENERATION with Groq AI
// ============================================

async function generateNaturalResponse(
    userMessage: string,
    mcpResponse: any,
    request: MCPRequest
): Promise<string> {
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
        } catch (error: any) {
            console.log(`⚠️  AI response generation failed, using simple format:`, error.message);
        }
    }

    // Fallback to simple response
    if (mcpResponse.success) {
        return mcpResponse.message || 'Operation completed successfully!';
    } else {
        return mcpResponse.error || mcpResponse.message || 'An error occurred.';
    }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main chat endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
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

        // Handle meta actions (greetings, identity, etc.)
        if (mcpRequest.action === 'meta') {
            const intent = mcpRequest.data?.intent;
            let response = '';

            if (intent === 'greeting') {
                response = 'Hey 👋 Ready when you are.';
            } else if (intent === 'assistant_identity') {
                response = "I'm your **Resource Manager assistant**.\nI help you see and manage what you're allowed to access.";
            } else if (intent === 'capabilities') {
                response = "I can help you with:\n• Files\n• Appointments\n• Projects\n• Access & permissions";
            } else if (intent === 'user_identity') {
                // Extract user name from userId (e.g., "user:tharsan" -> "Tharsan")
                const userName = userId.split(':')[1];
                const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);
                response = `You're **${capitalizedName}**.`;
            } else if (intent === 'permission_explanation') {
                // Extract user name and role
                const userName = userId.split(':')[1];
                const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

                // Simple role detection (you can enhance this)
                const isOwner = userName.toLowerCase() === 'tharsan';
                const role = isOwner ? 'owner' : 'viewer';

                if (isOwner) {
                    response = `You're the **owner** — you have full access to everything.`;
                } else {
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
                const deleteRequest: MCPRequest = {
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
            raw: mcpResponse  // Include raw response for debugging
        });

    } catch (error: any) {
        console.error(`❌ Error processing chat:`, error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred processing your request',
            message: 'Sorry, something went wrong. Please try again.'
        });
    }
});

// Serve index.html for root
app.get('/', (req: Request, res: Response) => {
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