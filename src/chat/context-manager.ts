/**
 * Conversation Context Manager
 * Manages pending actions and conversation state for multi-step workflows
 */

export interface PendingAction {
    action: 'awaiting_category' | 'creating_user' | 'creating_resource';
    data: {
        filename?: string;
        step?: 'awaiting_email' | 'awaiting_role';
        userData?: {
            name?: string;
            email?: string;
            role?: string;
        };
        // Multi-field resource creation
        resourceType?: string;
        collectedFields?: Record<string, any>;
        currentField?: string;
    };
    timestamp: number;
}

// Store pending actions per user
const pendingActions = new Map<number, PendingAction>();

/**
 * Store a pending action for a user
 */
export function setPendingAction(userId: number, action: PendingAction['action'], data: PendingAction['data']): void {
    pendingActions.set(userId, {
        action,
        data,
        timestamp: Date.now()
    });
    console.log(`💾 Stored pending action for user ${userId}:`, action);
}

/**
 * Get pending action for a user (auto-expires after 5 minutes)
 */
export function getPendingAction(userId: number): PendingAction | null {
    const pending = pendingActions.get(userId);

    if (!pending) {
        return null;
    }

    // Auto-expire after 5 minutes (300000ms)
    const age = Date.now() - pending.timestamp;
    if (age > 300000) {
        console.log(`⏰ Pending action expired for user ${userId} (age: ${Math.round(age / 1000)}s)`);
        pendingActions.delete(userId);
        return null;
    }

    return pending;
}

/**
 * Clear pending action for a user
 */
export function clearPendingAction(userId: number): void {
    const had = pendingActions.has(userId);
    pendingActions.delete(userId);
    if (had) {
        console.log(`🗑️  Cleared pending action for user ${userId}`);
    }
}

/**
 * Cleanup stale entries (older than 5 minutes)
 * Call this periodically to prevent memory leaks
 */
export function cleanupStaleActions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, pending] of pendingActions.entries()) {
        if (now - pending.timestamp > 300000) {
            pendingActions.delete(userId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} stale pending actions`);
    }

    return cleaned;
}

// Auto-cleanup every 5 minutes
setInterval(cleanupStaleActions, 300000);
