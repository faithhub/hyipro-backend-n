const pool = require('../config/database');

const getAuditLogs = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { user_id, actor_id, action, entity_type, from, to } = req.query;

    const conditions = [];
    const params     = [];

    if (user_id)     { conditions.push('al.user_id = ?');    params.push(parseInt(user_id)); }
    if (actor_id)    { conditions.push('al.actor_id = ?');   params.push(parseInt(actor_id)); }
    if (action)      { conditions.push('al.action = ?');     params.push(action); }
    if (entity_type) { conditions.push('al.entity_type = ?');params.push(entity_type); }
    if (from)        { conditions.push('al.created_at >= ?');params.push(new Date(from)); }
    if (to)          { conditions.push('al.created_at <= ?');params.push(new Date(to)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const connection = await pool.getConnection();
    try {
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) AS total FROM audit_logs al ${where}`,
        params
      );
      const total = Number(countRows[0].total);

      const [rows] = await connection.execute(
        `SELECT
           al.id,
           al.action,
           al.entity_type,
           al.entity_id,
           al.ip_address,
           al.user_agent,
           al.metadata,
           al.created_at,
           al.user_id,
           u.email  AS user_email,
           al.actor_id,
           a.email  AS actor_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         LEFT JOIN users a ON a.id = al.actor_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        audit_logs: rows,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Distinct action types present in the log (useful for frontend filter dropdowns)
const getAuditActions = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT DISTINCT action FROM audit_logs ORDER BY action ASC'
      );
      res.json({ actions: rows.map(r => r.action) });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Full activity trail for a single user (both actions they performed and actions taken against them)
const getUserAuditLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = ['(al.user_id = ? OR al.actor_id = ?)'];
    const params     = [userId, userId];

    if (req.query.action)      { conditions.push('al.action = ?');      params.push(req.query.action); }
    if (req.query.from)        { conditions.push('al.created_at >= ?'); params.push(new Date(req.query.from)); }
    if (req.query.to)          { conditions.push('al.created_at <= ?'); params.push(new Date(req.query.to)); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const connection = await pool.getConnection();
    try {
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) AS total FROM audit_logs al ${where}`,
        params
      );
      const total = Number(countRows[0].total);

      const [rows] = await connection.execute(
        `SELECT
           al.id,
           al.action,
           al.entity_type,
           al.entity_id,
           al.ip_address,
           al.user_agent,
           al.metadata,
           al.created_at,
           al.user_id,
           u.email  AS user_email,
           al.actor_id,
           a.email  AS actor_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         LEFT JOIN users a ON a.id = al.actor_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        user_id: userId,
        audit_logs: rows,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs, getAuditActions, getUserAuditLogs };
