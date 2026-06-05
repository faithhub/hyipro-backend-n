const pool = require('../config/database');

/**
 * Fire-and-forget audit logger. Never throws — a logging failure must not block a request.
 *
 * @param {object} req  - Express request (used to extract IP + user-agent)
 * @param {string} action - e.g. 'login', 'user.status_changed', 'withdrawal.approved'
 * @param {object} [opts]
 * @param {number} [opts.userId]      - The user the action was performed ON (or BY for self-actions)
 * @param {number} [opts.actorId]     - Who performed the action (admin acting on another user)
 * @param {string} [opts.entityType]  - e.g. 'user', 'withdrawal', 'deposit', 'plan'
 * @param {number} [opts.entityId]    - PK of the affected entity
 * @param {object} [opts.metadata]    - Any extra context (old/new values, reason, etc.)
 */
function logAudit(req, action, opts = {}) {
  const ip = req
    ? (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket?.remoteAddress || null)
    : null;
  const ua = req ? (req.headers['user-agent'] || null) : null;

  const { userId = null, actorId = null, entityType = null, entityId = null, metadata = null } = opts;

  // Async, non-blocking — errors are swallowed so they never affect the caller
  setImmediate(async () => {
    try {
      const connection = await pool.getConnection();
      try {
        await connection.execute(
          `INSERT INTO audit_logs (user_id, actor_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            actorId,
            action,
            entityType,
            entityId,
            ip,
            ua,
            metadata ? JSON.stringify(metadata) : null,
          ]
        );
      } finally {
        connection.release();
      }
    } catch {
      // Intentionally silent — audit log failure must not surface to users
    }
  });
}

module.exports = { logAudit };
