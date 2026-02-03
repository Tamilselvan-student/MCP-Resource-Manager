import pool from '../database.js';

export async function logAudit({
    userUuid,
    action,
    resourceUuid
}: {
    userUuid: string;
    action: 'read' | 'write';
    resourceUuid?: string;
}) {
    try {
        await pool.query(
            `
      INSERT INTO audit_logs (user_uuid, action, resource_uuid)
      VALUES ($1, $2, $3)
      `,
            [userUuid, action, resourceUuid ?? null]
        );
    } catch (err) {
        // Don't block response if logging fails
        console.error('[AUDIT] Failed to log:', err);
    }
}
