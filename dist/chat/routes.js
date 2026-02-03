import { Router } from 'express';
import { authenticateToken } from '../auth/middleware.js';
import { parseCommand } from './nlp-parser.js';
import { executeCommand } from './command-executor.js';
import { formatResponse } from './response-formatter.js';
import { getPendingAction } from './context-manager.js';
const router = Router();
// ============================================
// POST /api/chat/message - Main Chat Endpoint
// ============================================
router.post('/message', authenticateToken, async (req, res) => {
    const { message } = req.body;
    const userId = req.user.uuid; // UUID is already a string
    console.log(`\n💬 Chat message from ${req.user.username}: "${message}"`);
    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
            success: false,
            reply: '❌ Please provide a valid message',
            error: 'Invalid message'
        });
    }
    try {
        // ✅ STEP 1: CHECK FOR PENDING CONTEXT FIRST - BEFORE parseCommand
        const pendingContext = getPendingAction(userId);
        if (pendingContext) {
            console.log('🎯 CONTEXT FOUND - User has pending action:', pendingContext.action);
            // ✅ CHECK FOR CANCELLATION FIRST
            const msgLower = message.trim().toLowerCase();
            const cancellationKeywords = [
                'cancel', 'stop', 'no need', 'never mind', 'forget it',
                'quit', 'exit', 'abort', 'no thanks', 'nvm', 'nevermind',
                'skip', 'don\'t need', 'not needed', 'no', 'nope'
            ];
            const isCancellation = cancellationKeywords.some(keyword => msgLower === keyword || msgLower.includes(keyword));
            if (isCancellation) {
                console.log('🚫 User cancelled pending action');
                const { clearPendingAction } = await import('./context-manager.js');
                clearPendingAction(userId);
                return res.json({
                    success: true,
                    reply: '✅ Okay, cancelled. Let me know if you need anything else!',
                    action: {
                        type: 'cancelled',
                        affected: []
                    }
                });
            }
            // Route to appropriate handler based on pending action
            if (pendingContext.action === 'awaiting_category') {
                // User is responding to "Which category?" question
                console.log(`📁 Routing to create_resource handler with category response: "${message}"`);
                const parsedCommand = {
                    intent: 'create_resource',
                    entities: {
                        resource: pendingContext.data.filename,
                        category: message // User's response: "3. Documentation"
                    },
                    raw: message,
                    confidence: 1.0
                };
                const result = await executeCommand(parsedCommand, userId);
                const formattedReply = formatResponse(result, 'create_resource');
                return res.json({
                    success: result.success,
                    reply: formattedReply,
                    action: {
                        type: 'create_resource',
                        affected: result.data ? [result.data] : []
                    },
                    data: result.data
                });
            }
            if (pendingContext.action === 'creating_user') {
                // User is responding to email or role question
                const step = pendingContext.data.step;
                console.log(`👤 Routing to create_user handler, step: ${step}, response: "${message}"`);
                const parsedCommand = {
                    intent: 'create_user',
                    entities: {},
                    raw: message,
                    confidence: 1.0
                };
                const result = await executeCommand(parsedCommand, userId);
                const formattedReply = formatResponse(result, 'create_user');
                return res.json({
                    success: result.success,
                    reply: formattedReply,
                    action: {
                        type: 'create_user',
                        affected: result.data ? [result.data] : []
                    },
                    data: result.data
                });
            }
            if (pendingContext.action === 'creating_resource') {
                // User is responding to field collection for resource creation
                const currentField = pendingContext.data.currentField;
                console.log(`📝 Routing to create_resource handler, field: ${currentField}, response: "${message}"`);
                const parsedCommand = {
                    intent: 'create_resource',
                    entities: {},
                    raw: message,
                    confidence: 1.0
                };
                const result = await executeCommand(parsedCommand, userId);
                const formattedReply = formatResponse(result, 'create_resource');
                return res.json({
                    success: result.success,
                    reply: formattedReply,
                    action: {
                        type: 'create_resource',
                        affected: result.data ? [result.data] : []
                    },
                    data: result.data
                });
            }
        }
        // ✅ STEP 2: ONLY parse as new command if no pending context
        console.log('🆕 No pending context - Parsing as new command');
        const parsedCommand = await parseCommand(message);
        console.log(`🔍 Parsed intent: ${parsedCommand.intent}, entities:`, parsedCommand.entities);
        if (parsedCommand.intent === 'unknown') {
            return res.json({
                success: false,
                reply: "❌ I didn't understand that command. Type 'help' to see available commands.",
                action: {
                    type: 'unknown',
                    affected: []
                }
            });
        }
        // Step 2: Execute the command
        console.log(`⚙️  Executing command with userId: ${userId} (type: ${typeof userId})`);
        const result = await executeCommand(parsedCommand, userId);
        console.log(`${result.success ? '✅' : '❌'} Command executed: ${parsedCommand.intent}`);
        // Step 3: Format the response
        const formattedReply = formatResponse(result, parsedCommand.intent);
        // Step 4: Return response
        return res.json({
            success: result.success,
            reply: formattedReply,
            action: {
                type: parsedCommand.intent,
                affected: result.data ? [result.data] : []
            },
            data: result.data
        });
    }
    catch (error) {
        console.error('❌ Error processing chat message:', error);
        return res.status(500).json({
            success: false,
            reply: '❌ An error occurred while processing your request. Please try again.',
            error: error.message
        });
    }
});
// ============================================
// GET /api/chat/health - Health Check
// ============================================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Chat service is running',
        timestamp: new Date().toISOString()
    });
});
export default router;
