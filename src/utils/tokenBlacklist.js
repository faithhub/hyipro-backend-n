const crypto = require('crypto');
const pool = require('../config/database');

// In-memory set of blacklisted JTIs for O(1) lookup
const blacklistedJtis = new Set();

// Load all non-expired blacklisted JTIs from DB at startup
async function initBlacklist() {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT jti FROM token_blacklist WHERE expires_at > NOW()'
      );
      for (const row of rows) blacklistedJtis.add(row.jti);
    } finally {
      connection.release();
    }
  } catch (err) {
    // Non-fatal — blacklist starts empty if DB is unavailable at boot
    console.error('[tokenBlacklist] Failed to load from DB at startup:', err.message);
  }
}

// Add a JTI to both DB and in-memory set
async function addToBlacklist(jti, userId, expiresAt) {
  blacklistedJtis.add(jti);
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `INSERT INTO token_blacklist (jti, user_id, expires_at)
       VALUES (?, ?, ?)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, userId, new Date(expiresAt * 1000)]
    );
  } finally {
    connection.release();
  }
}

// Blacklist all tokens for a user issued before a given timestamp
// by setting force_logout_at — no need to enumerate tokens
async function forceLogoutUser(userId) {
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      'UPDATE users SET force_logout_at = NOW() WHERE id = ?',
      [userId]
    );
  } finally {
    connection.release();
  }
}

// Check in-memory set — O(1), no DB hit
function isBlacklisted(jti) {
  if (!jti) return false;
  return blacklistedJtis.has(jti);
}

// Remove expired entries from DB and rebuild in-memory set
async function cleanupExpiredBlacklist() {
  const connection = await pool.getConnection();
  try {
    await connection.execute('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
    const [rows] = await connection.execute(
      'SELECT jti FROM token_blacklist WHERE expires_at > NOW()'
    );
    blacklistedJtis.clear();
    for (const row of rows) blacklistedJtis.add(row.jti);
  } finally {
    connection.release();
  }
}

module.exports = { initBlacklist, addToBlacklist, forceLogoutUser, isBlacklisted, cleanupExpiredBlacklist };
