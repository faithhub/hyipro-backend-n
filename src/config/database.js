const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pgPool.on('connect', () => {
  console.log('✅ Database connection established');
});

pgPool.on('error', (err) => {
  console.error('❌ Database error:', err);
});

/**
 * Convert MySQL-style ? placeholders to PostgreSQL $1, $2, ... placeholders.
 * Also normalizes MySQL-specific SQL to PostgreSQL.
 */
function convertQuery(sql) {
  let pgSql = sql;
  let paramIndex = 1;

  // Convert MySQL double-quoted string literals to single quotes in common WHERE clauses
  // e.g. WHERE role = "user" → WHERE role = 'user'
  // Handles: = "value", IN ("a", "b"), status = "active"
  pgSql = pgSql.replace(/= ?"([^"]+)"/g, (m, v) => `= '${v}'`);
  pgSql = pgSql.replace(/= ?"([^"]+)"/g, (m, v) => `= '${v}'`);
  // Handle status IN ("active") style
  pgSql = pgSql.replace(/"([^"]+)"/g, (m, v) => `'${v}'`);

  // Replace ? with $N
  pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

  // MySQL INFORMATION_SCHEMA column existence check → PostgreSQL
  pgSql = pgSql.replace(
    /SELECT\s+COUNT\(\*\)\s+AS\s+(\w+)\s+FROM\s+INFORMATION_SCHEMA\.COLUMNS\s+WHERE\s+TABLE_SCHEMA\s*=\s*DATABASE\(\)\s+AND\s+TABLE_NAME\s*=\s*'([^']+)'\s+AND\s+COLUMN_NAME\s*=\s*'([^']+)'/gi,
    (match, alias, tbl, col) =>
      `SELECT COUNT(*) AS ${alias} FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tbl.toLowerCase()}' AND column_name = '${col.toLowerCase()}'`
  );
  // Parameterized version
  pgSql = pgSql.replace(
    /SELECT\s+COUNT\(\*\)\s+AS\s+(\w+)\s+FROM\s+INFORMATION_SCHEMA\.COLUMNS\s+WHERE\s+TABLE_SCHEMA\s*=\s*DATABASE\(\)\s+AND\s+TABLE_NAME\s*=\s*\$(\d+)\s+AND\s+COLUMN_NAME\s*=\s*\$(\d+)/gi,
    (match, alias, p1, p2) =>
      `SELECT COUNT(*) AS ${alias} FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $${p1} AND column_name = $${p2}`
  );

  // Generic INFORMATION_SCHEMA DATABASE() → public
  pgSql = pgSql.replace(/TABLE_SCHEMA\s*=\s*DATABASE\(\)/gi, "table_schema = 'public'");
  pgSql = pgSql.replace(/INFORMATION_SCHEMA\./gi, 'information_schema.');

  // CURDATE() → CURRENT_DATE
  pgSql = pgSql.replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE');

  // MySQL specific upsert: INSERT INTO wallets (user_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance = balance + ?
  pgSql = pgSql.replace(
    /INSERT INTO wallets \(user_id, balance\) VALUES \(\$(\d+), \$(\d+)\)\s+ON DUPLICATE KEY UPDATE balance = balance \+ \$(\d+)/gi,
    (match, p1, p2, p3) =>
      `INSERT INTO wallets (user_id, balance) VALUES ($${p1}, $${p2}) ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + $${p3}`
  );

  // ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
  pgSql = pgSql.replace(
    /ON DUPLICATE KEY UPDATE setting_value = VALUES\(setting_value\)/gi,
    'ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value'
  );

  // Generic ON DUPLICATE KEY UPDATE → ON CONFLICT DO NOTHING (fallback)
  pgSql = pgSql.replace(/\bON DUPLICATE KEY UPDATE\b.*/gi, 'ON CONFLICT DO NOTHING');

  // ADD COLUMN IF NOT EXISTS (MySQL) → ADD COLUMN IF NOT EXISTS (supported in PG 9.6+)
  // Keep as-is; PostgreSQL supports IF NOT EXISTS in ALTER TABLE ADD COLUMN

  // MySQL-specific: MODIFY column (not supported in PostgreSQL)
  // These only appear in migration scripts, not in runtime queries

  return pgSql;
}

/**
 * Map PostgreSQL result rows to be MySQL-compatible.
 * PostgreSQL returns boolean as true/false, MySQL returns 1/0.
 */
function mapRows(rows) {
  return rows.map(row => {
    const mapped = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'boolean') {
        mapped[key] = value ? 1 : 0;
      } else {
        mapped[key] = value;
      }
    }
    return mapped;
  });
}

/**
 * Execute a query and return mysql2-compatible results.
 * For SELECT → [rows, fields]
 * For INSERT → [{insertId, affectedRows}, fields]
 * For UPDATE/DELETE → [{affectedRows, changedRows}, fields]
 */
async function executeQuery(client, sql, params = []) {
  const pgSql = convertQuery(sql);
  const pgParams = Array.isArray(params) ? params : [];

  const isInsert = /^\s*INSERT\s+/i.test(pgSql);
  const hasReturning = /\bRETURNING\b/i.test(pgSql);

  let finalSql = pgSql;
  if (isInsert && !hasReturning) {
    // Append RETURNING id to get insertId
    finalSql = pgSql.trim().replace(/;?\s*$/, '') + ' RETURNING id';
  }

  let result;
  try {
    result = await client.query(finalSql, pgParams);
  } catch (err) {
    // If RETURNING id caused syntax error, retry without it
    if (isInsert && !hasReturning) {
      try {
        result = await client.query(pgSql, pgParams);
      } catch (err2) {
        throw err2;
      }
    } else {
      throw err;
    }
  }

  const rows = mapRows(result.rows || []);

  if (isInsert) {
    const insertId = rows.length > 0 && rows[0].id !== undefined ? rows[0].id : 0;
    return [{ insertId, affectedRows: result.rowCount || 0, changedRows: 0 }, result.fields || []];
  }

  if (/^\s*(UPDATE|DELETE)\s+/i.test(pgSql)) {
    return [{ affectedRows: result.rowCount || 0, changedRows: result.rowCount || 0, insertId: 0 }, result.fields || []];
  }

  return [rows, result.fields || []];
}

/**
 * Connection object that mimics mysql2's PoolConnection
 */
class PgConnection {
  constructor(client, releaseFn) {
    this._client = client;
    this._release = releaseFn;
    this._inTransaction = false;
  }

  async execute(sql, params = []) {
    return executeQuery(this._client, sql, params);
  }

  async query(sql, params = []) {
    return executeQuery(this._client, sql, params);
  }

  async beginTransaction() {
    await this._client.query('BEGIN');
    this._inTransaction = true;
  }

  async commit() {
    await this._client.query('COMMIT');
    this._inTransaction = false;
  }

  async rollback() {
    try {
      await this._client.query('ROLLBACK');
    } catch (e) {
      // ignore
    }
    this._inTransaction = false;
  }

  release() {
    if (this._inTransaction) {
      this._client.query('ROLLBACK').catch(() => {}).finally(() => this._release());
    } else {
      this._release();
    }
  }
}

/**
 * Pool wrapper that mimics mysql2's Pool API
 */
const pool = {
  async getConnection() {
    const client = await pgPool.connect();
    return new PgConnection(client, () => client.release());
  },

  async execute(sql, params = []) {
    const client = await pgPool.connect();
    try {
      return await executeQuery(client, sql, params);
    } finally {
      client.release();
    }
  },

  async query(sql, params = []) {
    const client = await pgPool.connect();
    try {
      return await executeQuery(client, sql, params);
    } finally {
      client.release();
    }
  },

  _pgPool: pgPool,
};

module.exports = pool;
