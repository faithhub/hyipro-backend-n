const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { isBlacklisted } = require('../utils/tokenBlacklist');

// In-memory status cache: userId -> { status, role, force_logout_at, expiresAt }
const statusCache = new Map();
const STATUS_CACHE_TTL_MS = 60 * 1000; // 1 minute

async function fetchUserStatus(userId) {
  const cached = statusCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return { status: cached.status, role: cached.role, force_logout_at: cached.force_logout_at };
  }
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT status, role, force_logout_at FROM users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) return null;
    const { status, role, force_logout_at } = rows[0];
    statusCache.set(userId, { status, role, force_logout_at, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
    return { status, role, force_logout_at };
  } finally {
    connection.release();
  }
}

function invalidateStatusCache(userId) {
  statusCache.delete(userId);
}

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check token blacklist (individual logout)
    if (isBlacklisted(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Verify current status from DB (with cache)
    const dbUser = await fetchUserStatus(decoded.id);
    if (!dbUser) {
      return res.status(401).json({ error: 'Account not found' });
    }
    if (dbUser.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    // Check force-logout: reject tokens issued before force_logout_at
    if (dbUser.force_logout_at) {
      const forceLogoutTime = new Date(dbUser.force_logout_at).getTime();
      const tokenIssuedAt = decoded.iat * 1000;
      if (tokenIssuedAt < forceLogoutTime) {
        return res.status(401).json({ error: 'Session has been terminated. Please log in again.' });
      }
    }

    req.user = { ...decoded, role: dbUser.role, status: dbUser.status };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

module.exports = { authMiddleware, adminMiddleware, invalidateStatusCache };
