const pool = require('../config/database');
const { logAudit } = require('../utils/auditLog');
const { sendEmail } = require('../utils/mailer');

// Plan Management
const getAllPlans = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM plans');
      const total = countResult[0].total;

      const [plans] = await connection.execute(
        `SELECT id, name, description, min_deposit, max_deposit, 
                daily_profit_percentage, duration_days, status, created_at, updated_at,
                projected_return_weekly, estimated_monthly, capital_withdrawal, support_level, audience_label
         FROM plans 
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({
        plans,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Allow user to re-upload after rejection
const allowKycResubmit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `UPDATE kyc_documents 
         SET allow_resubmit = 1, status = 'rejected', reviewed_at = NOW(), admin_notes = COALESCE(admin_notes, 'Re-upload permitted by admin')
         WHERE user_id = ? AND status IN ('pending','rejected')`,
        [id]
      );

      await connection.execute('UPDATE users SET kyc_verified = false WHERE id = ?', [id]);

      res.json({ message: 'User may re-upload KYC documents' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getUserKycDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [docs] = await connection.execute(
        `SELECT id, document_type, file_path, status, admin_notes, submitted_at, reviewed_at, allow_resubmit
         FROM kyc_documents
         WHERE user_id = ?
         ORDER BY submitted_at DESC`,
        [id]
      );

      res.json({ documents: docs });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getUserSubscriptions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const filters = [];
      const params = [id];
      if (status) {
        filters.push('s.status = ?');
        params.push(status);
      }

      const whereClause = filters.length ? `AND ${filters.join(' AND ')}` : '';

      const [[countRow]] = await connection.execute(
        `SELECT COUNT(*) as total FROM subscriptions s WHERE s.user_id = ? ${whereClause}`,
        params
      );

      const [rows] = await connection.execute(
        `SELECT s.id, p.name, s.amount, s.start_date, s.end_date, s.status 
         FROM subscriptions s 
         JOIN plans p ON s.plan_id = p.id 
         WHERE s.user_id = ? ${whereClause}
         ORDER BY s.created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        subscriptions: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          totalPages: Math.ceil(countRow.total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getUserTransactions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, status, from, to } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const filters = [];
      const params = [id];
      if (type) {
        filters.push('type = ?');
        params.push(type);
      }
      if (status) {
        filters.push('status = ?');
        params.push(status);
      }
      if (from) {
        filters.push('created_at >= ?');
        params.push(from);
      }
      if (to) {
        filters.push('created_at <= ?');
        params.push(to);
      }
      const whereClause = filters.length ? `AND ${filters.join(' AND ')}` : '';

      const [[countRow]] = await connection.execute(
        `SELECT COUNT(*) as total FROM transactions WHERE user_id = ? ${whereClause}`,
        params
      );

      const [rows] = await connection.execute(
        `SELECT id, type, crypto_type, amount, status, created_at 
         FROM transactions 
         WHERE user_id = ? ${whereClause}
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        transactions: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          totalPages: Math.ceil(countRow.total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getUserEarnings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const filters = [];
      const params = [id];
      if (from) {
        filters.push('e.earned_date >= ?');
        params.push(from);
      }
      if (to) {
        filters.push('e.earned_date <= ?');
        params.push(to);
      }
      const whereClause = filters.length ? `AND ${filters.join(' AND ')}` : '';

      const [[countRow]] = await connection.execute(
        `SELECT COUNT(*) as total 
         FROM earnings e 
         JOIN subscriptions s ON e.subscription_id = s.id 
         WHERE s.user_id = ? ${whereClause}`,
        params
      );

      const [rows] = await connection.execute(
        `SELECT e.id, e.amount, e.earned_date, p.name as plan_name 
         FROM earnings e 
         JOIN subscriptions s ON e.subscription_id = s.id 
         LEFT JOIN plans p ON s.plan_id = p.id 
         WHERE s.user_id = ? ${whereClause}
         ORDER BY e.earned_date DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        earnings: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          totalPages: Math.ceil(countRow.total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getUserWithdrawals = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, from, to } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const filters = [];
      const params = [id];
      if (status) {
        filters.push('status = ?');
        params.push(status);
      }
      if (from) {
        filters.push('created_at >= ?');
        params.push(from);
      }
      if (to) {
        filters.push('created_at <= ?');
        params.push(to);
      }
      const whereClause = filters.length ? `AND ${filters.join(' AND ')}` : '';

      const [[countRow]] = await connection.execute(
        `SELECT COUNT(*) as total FROM withdrawal_requests WHERE user_id = ? ${whereClause}`,
        params
      );

      const [rows] = await connection.execute(
        `SELECT id, subscription_id, amount, crypto_type, wallet_address, status, created_at 
         FROM withdrawal_requests 
         WHERE user_id = ? ${whereClause}
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        withdrawals: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          totalPages: Math.ceil(countRow.total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const createPlan = async (req, res, next) => {
  try {
    const { name, description, min_deposit, max_deposit, daily_profit_percentage, duration_days,
             projected_return_weekly, estimated_monthly, capital_withdrawal, support_level, audience_label } = req.body;

    if (!name || !min_deposit || !max_deposit || !daily_profit_percentage || !duration_days) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.execute(
        `INSERT INTO plans (name, description, min_deposit, max_deposit, daily_profit_percentage, duration_days, status,
         projected_return_weekly, estimated_monthly, capital_withdrawal, support_level, audience_label) 
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
        [name, description || null, min_deposit, max_deposit, daily_profit_percentage, duration_days,
         projected_return_weekly || null, estimated_monthly || null, capital_withdrawal || null, 
         support_level || null, audience_label || null]
      );

      res.status(201).json({
        message: 'Plan created successfully',
        plan: {
          id: result.insertId,
          name,
          description,
          min_deposit,
          max_deposit,
          daily_profit_percentage,
          duration_days,
          status: 'active',
          projected_return_weekly: projected_return_weekly || null,
          estimated_monthly: estimated_monthly || null,
          capital_withdrawal: capital_withdrawal || null,
          support_level: support_level || null,
          audience_label: audience_label || null
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      name, description, min_deposit, max_deposit, daily_profit_percentage, duration_days,
      projected_return_weekly, estimated_monthly, capital_withdrawal, support_level, audience_label
    } = req.body;

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `UPDATE plans 
         SET name = ?, description = ?, min_deposit = ?, max_deposit = ?, 
             daily_profit_percentage = ?, duration_days = ?,
             projected_return_weekly = ?, estimated_monthly = ?,
             capital_withdrawal = ?, support_level = ?, audience_label = ?
         WHERE id = ?`,
        [name, description || null, min_deposit, max_deposit, daily_profit_percentage, duration_days,
         projected_return_weekly || null, estimated_monthly || null, capital_withdrawal || null, 
         support_level || null, audience_label || null, id]
      );

      res.json({ message: 'Plan updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updatePlanStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'stopped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE plans SET status = ? WHERE id = ?',
        [status, id]
      );

      res.json({ message: `Plan ${status} successfully` });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// User Management
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, status, role, kyc, has_docs } = req.query;

    const connection = await pool.getConnection();

    try {
      const includeStatus = true;

      const conditions = [];
      const params = [];

      if (search) {
        const term = `%${search.toLowerCase()}%`;
        conditions.push('(LOWER(u.email) LIKE ? OR LOWER(u.first_name) LIKE ? OR LOWER(u.last_name) LIKE ?)');
        params.push(term, term, term);
      }

      if (includeStatus && status) {
        conditions.push('u.status = ?');
        params.push(status);
      }

      if (role) {
        conditions.push('u.role = ?');
        params.push(role);
      }

      if (kyc) {
        if (kyc === 'verified') {
          conditions.push('u.kyc_verified = true');
        } else if (kyc === 'pending') {
          conditions.push('u.kyc_verified = false');
        }
      }

      if (has_docs) {
        conditions.push('EXISTS (SELECT 1 FROM kyc_documents kd WHERE kd.user_id = u.id)');
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [countResult] = await connection.execute(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params);
      const total = countResult[0].total;

      const [users] = await connection.execute(
        `SELECT 
           u.id, u.email, u.first_name, u.last_name, u.country, u.kyc_verified, u.role${includeStatus ? ', u.status' : ''}, u.created_at,
           (SELECT kd.status FROM kyc_documents kd WHERE kd.user_id = u.id ORDER BY kd.submitted_at DESC LIMIT 1) AS kyc_status_latest,
           COALESCE(w.balance, 0) AS wallet_balance
         FROM users u
         LEFT JOIN wallets w ON w.user_id = u.id
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute(
        `SELECT id, email, first_name, last_name, phone, country, kyc_verified, role, status, created_at, last_login, last_ip, user_agent FROM users WHERE id = ?`,
        [id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];

      // Wallet addresses
      const [walletRows] = await connection.execute(
        `SELECT btc_address, eth_address FROM wallets WHERE user_id = ?`,
        [id]
      );
      const wallet = walletRows[0] || { btc_address: null, eth_address: null };

      // Get user subscriptions
      const [subscriptions] = await connection.execute(
        `SELECT s.id, p.name, s.amount, s.start_date, s.end_date, s.status 
         FROM subscriptions s 
         JOIN plans p ON s.plan_id = p.id 
         WHERE s.user_id = ?`,
        [id]
      );

      // Get user transactions
      const [transactions] = await connection.execute(
        `SELECT id, type, crypto_type, amount, status, created_at 
         FROM transactions 
         WHERE user_id = ? 
         ORDER BY created_at DESC
         LIMIT 20`,
        [id]
      );

      // Get user earnings
      const [earnings] = await connection.execute(
        `SELECT e.id, e.amount, e.earned_date, p.name as plan_name 
         FROM earnings e 
         LEFT JOIN subscriptions s ON e.subscription_id = s.id 
         LEFT JOIN plans p ON s.plan_id = p.id 
         WHERE s.user_id = ? 
         ORDER BY e.earned_date DESC
         LIMIT 20`,
        [id]
      );

      // Recent withdrawals
      const [withdrawals] = await connection.execute(
        `SELECT id, subscription_id, amount, crypto_type, wallet_address, status, created_at 
         FROM withdrawal_requests 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [id]
      );

      // KYC documents (latest 10)
      const [kycDocs] = await connection.execute(
        `SELECT id, document_type, file_path, status, admin_notes, submitted_at, reviewed_at, allow_resubmit
         FROM kyc_documents
         WHERE user_id = ?
         ORDER BY submitted_at DESC
         LIMIT 10`,
        [id]
      );

      const [resetRequests] = await connection.execute(
        `SELECT id, email, status, requested_ip, user_agent, requested_at, expires_at, used_at
         FROM password_reset_requests
         WHERE user_id = ?
         ORDER BY requested_at DESC
         LIMIT 20`,
        [id]
      );

      // Wallet balance from wallets table
      const [[walletRow]] = await connection.execute(
        `SELECT balance FROM wallets WHERE user_id = ?`,
        [id]
      );
      const wallet_balance = walletRow ? Number(walletRow.balance) : 0;

      // Aggregate totals for balance view
      const [[depositTotals]] = await connection.execute(
        `SELECT COALESCE(SUM(amount), 0) as total_deposits 
         FROM transactions 
         WHERE user_id = ? AND type = 'deposit' AND status = 'confirmed'`,
        [id]
      );

      const [[earningsTotals]] = await connection.execute(
        `SELECT COALESCE(SUM(e.amount), 0) as total_earnings 
         FROM earnings e 
         JOIN subscriptions s ON e.subscription_id = s.id 
         WHERE s.user_id = ?`,
        [id]
      );

      const [[withdrawalTotals]] = await connection.execute(
        `SELECT 
           COALESCE(SUM(CASE WHEN status = 'approved' THEN amount END), 0) as total_withdrawn,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) as pending_withdrawal_amount
         FROM withdrawal_requests
         WHERE user_id = ?`,
        [id]
      );

      res.json({
        user,
        subscriptions,
        transactions,
        earnings,
        withdrawals,
        kyc_documents: kycDocs,
        reset_requests: resetRequests,
        wallet,
        totals: {
          total_deposits: Number(depositTotals.total_deposits),
          total_earnings: Number(earningsTotals.total_earnings),
          total_withdrawn: Number(withdrawalTotals.total_withdrawn),
          pending_withdrawal_amount: Number(withdrawalTotals.pending_withdrawal_amount),
          wallet_balance
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getPasswordResetRequests = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, email, user_id } = req.query;

    const connection = await pool.getConnection();

    try {
      const conditions = [];
      const params = [];

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      if (email) {
        conditions.push('email LIKE ?');
        params.push(`%${email}%`);
      }
      if (user_id) {
        conditions.push('user_id = ?');
        params.push(user_id);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM password_reset_requests ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      const [requests] = await connection.execute(
        `SELECT id, user_id, email, status, requested_ip, user_agent, requested_at, expires_at, used_at
         FROM password_reset_requests
         ${whereClause}
         ORDER BY requested_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getUserPasswordResetRequests = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM password_reset_requests WHERE user_id = ?',
        [id]
      );
      const total = countResult[0].total;

      const [requests] = await connection.execute(
        `SELECT id, email, status, requested_ip, user_agent, requested_at, expires_at, used_at
         FROM password_reset_requests
         WHERE user_id = ?
         ORDER BY requested_at DESC
         LIMIT ? OFFSET ?`,
        [id, limit, offset]
      );

      res.json({
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, country, email } = req.body;

    const connection = await pool.getConnection();

    try {
      // Check if email is being changed and if it's already taken
      if (email) {
        const [existing] = await connection.execute(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, id]
        );
        if (existing.length > 0) {
          return res.status(409).json({ error: 'Email already in use by another user' });
        }
      }

      await connection.execute(
        `UPDATE users 
         SET first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone),
             country = COALESCE(?, country),
             email = COALESCE(?, email)
         WHERE id = ?`,
        [first_name || null, last_name || null, phone || null, country || null, email || null, id]
      );

      res.json({ message: 'User updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updateUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, id]
      );

      res.json({ message: 'User password updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      // Prevent deleting yourself
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
      }

      // Delete related records first
      // Earnings are linked through subscriptions, so delete subscriptions first (cascade will handle earnings)
      await connection.execute('DELETE FROM withdrawal_requests WHERE user_id = ?', [id]);
      await connection.execute('DELETE FROM transactions WHERE user_id = ?', [id]);
      await connection.execute('DELETE FROM subscriptions WHERE user_id = ?', [id]);
      await connection.execute('DELETE FROM users WHERE id = ?', [id]);

      logAudit(req, 'admin.user_deleted', { userId: parseInt(id), actorId: req.user.id, entityType: 'user', entityId: parseInt(id) });

      res.json({ message: 'User and all related data deleted successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const forceLogoutUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot force-logout yourself' });
    }

    const { forceLogoutUser: doForceLogout } = require('../utils/tokenBlacklist');
    await doForceLogout(parseInt(id));

    const { invalidateStatusCache } = require('../middleware/auth');
    invalidateStatusCache(parseInt(id));

    logAudit(req, 'admin.force_logout', { userId: parseInt(id), actorId: req.user.id, entityType: 'user', entityId: parseInt(id) });

    res.json({ message: 'User session terminated. They will be logged out on their next request.' });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    // Prevent changing your own role
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, id]
      );

      const { invalidateStatusCache } = require('../middleware/auth');
      invalidateStatusCache(parseInt(id));

      logAudit(req, 'admin.user_role_changed', { userId: parseInt(id), actorId: req.user.id, entityType: 'user', entityId: parseInt(id), metadata: { role } });

      res.json({ message: `User role updated to ${role}` });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "active" or "suspended"' });
    }

    // Prevent suspending yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot suspend your own account' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE users SET status = ? WHERE id = ?',
        [status, id]
      );

      const { invalidateStatusCache } = require('../middleware/auth');
      invalidateStatusCache(parseInt(id));

      logAudit(req, 'admin.user_status_changed', { userId: parseInt(id), actorId: req.user.id, entityType: 'user', entityId: parseInt(id), metadata: { status } });

      res.json({ message: `User ${status} successfully` });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updateUserKyc = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { kyc_verified } = req.body;

    if (typeof kyc_verified !== 'boolean') {
      return res.status(400).json({ error: 'kyc_verified must be a boolean' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE users SET kyc_verified = ? WHERE id = ?',
        [kyc_verified, id]
      );

      // Update latest kyc_documents status and reviewed_at/admin_notes when admin verifies or rejects
      if (kyc_verified) {
        await connection.execute(
          `UPDATE kyc_documents SET status = 'approved', reviewed_at = NOW(), admin_notes = COALESCE(admin_notes, 'Approved by admin') WHERE user_id = ? AND status = 'pending'`,
          [id]
        );
      } else {
        // Optionally allow admin to pass admin_notes in body
        const admin_notes = req.body.admin_notes || 'Rejected by admin';
        await connection.execute(
          `UPDATE kyc_documents SET status = 'rejected', reviewed_at = NOW(), admin_notes = ? WHERE user_id = ? AND status IN ('pending','approved')`,
          [admin_notes, id]
        );
        // When rejected, ensure user kyc_verified flag is false (already set above)
      }

      logAudit(req, kyc_verified ? 'admin.kyc_approved' : 'admin.kyc_rejected', { userId: parseInt(id), actorId: req.user.id, entityType: 'user', entityId: parseInt(id), metadata: { kyc_verified } });

      res.json({ message: `KYC ${kyc_verified ? 'verified' : 'unverified'} successfully` });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Withdrawal Management
const getAllWithdrawals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM withdrawal_requests');
      const total = countResult[0].total;

      const [withdrawals] = await connection.execute(
        `SELECT wr.id, wr.user_id, u.email, wr.amount, wr.crypto_type, 
                wr.wallet_address, wr.status, wr.created_at, wr.processed_at 
         FROM withdrawal_requests wr 
         JOIN users u ON wr.user_id = u.id 
         ORDER BY wr.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({
        withdrawals,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const approveWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE withdrawal_requests SET status = ?, processed_at = NOW() WHERE id = ?',
        ['approved', id]
      );

      logAudit(req, 'admin.withdrawal_approved', { actorId: req.user.id, entityType: 'withdrawal', entityId: parseInt(id) });

      res.json({ message: 'Withdrawal approved successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const rejectWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE withdrawal_requests SET status = ?, processed_at = NOW() WHERE id = ?',
        ['rejected', id]
      );

      logAudit(req, 'admin.withdrawal_rejected', { actorId: req.user.id, entityType: 'withdrawal', entityId: parseInt(id) });

      res.json({ message: 'Withdrawal rejected successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Dashboard Stats
const getDashboardStats = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      // Total users
      const [userStats] = await connection.execute(
        'SELECT COUNT(*) as total_users FROM users WHERE role = "user"'
      );

      // Total subscriptions
      const [subscriptionStats] = await connection.execute(
        'SELECT COUNT(*) as total_subscriptions, SUM(amount) as total_invested FROM subscriptions WHERE status = "active"'
      );

      // Total earnings
      const [earningsStats] = await connection.execute(
        'SELECT SUM(amount) as total_earnings FROM earnings'
      );

      // Pending withdrawals
      const [withdrawalStats] = await connection.execute(
        'SELECT COUNT(*) as pending_withdrawals, SUM(amount) as pending_amount FROM withdrawal_requests WHERE status = "pending"'
      );

      // Active plans
      const [planStats] = await connection.execute(
        'SELECT COUNT(*) as active_plans FROM plans WHERE status = "active"'
      );

      res.json({
        stats: {
          total_users: userStats[0].total_users,
          total_subscriptions: subscriptionStats[0].total_subscriptions,
          total_invested: subscriptionStats[0].total_invested || 0,
          total_earnings: earningsStats[0].total_earnings || 0,
          pending_withdrawals: withdrawalStats[0].pending_withdrawals,
          pending_withdrawal_amount: withdrawalStats[0].pending_amount || 0,
          active_plans: planStats[0].active_plans
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Wallet management for admin
const getAllWallets = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [wallets] = await connection.execute(
        `SELECT w.id, w.user_id, w.btc_address, w.eth_address, w.balance,
                (COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = w.user_id AND type = 'deposit' AND status = 'confirmed'),0) +
                 COALESCE((SELECT SUM(amount) FROM earnings WHERE subscription_id IN (SELECT id FROM subscriptions WHERE user_id = w.user_id)),0) -
                 COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = w.user_id AND status = 'approved'),0)) AS computed_balance
         FROM wallets w
         ORDER BY w.id DESC`
      );

      // Fetch owner emails
      for (const w of wallets) {
        const [users] = await connection.execute('SELECT email, first_name, last_name FROM users WHERE id = ?', [w.user_id]);
        w.owner = users.length ? `${users[0].first_name || ''} ${users[0].last_name || ''}`.trim() || users[0].email : null;
      }

      res.json({ wallets });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getWalletTransactions = async (req, res, next) => {
  try {
    const { id } = req.params; // wallet id
    const connection = await pool.getConnection();

    try {
      const [[walletRow]] = await connection.execute('SELECT user_id FROM wallets WHERE id = ?', [id]);
      if (!walletRow || !walletRow.user_id) return res.status(404).json({ error: 'Wallet not found' });

      const [transactions] = await connection.execute(
        `SELECT id, type, crypto_type, amount, status, tx_hash, created_at, confirmed_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC`,
        [walletRow.user_id]
      );

      res.json({ transactions });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Admin can set an explicit balance on a wallet (adds 'balance' column if missing)
const updateWalletBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { balance } = req.body;

    if (typeof balance === 'undefined') return res.status(400).json({ error: 'balance is required' });

    const connection = await pool.getConnection();
    try {
      await connection.execute('UPDATE wallets SET balance = ? WHERE id = ?', [balance, id]);

      res.json({ message: 'Wallet balance updated' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Deposit management for admin
const getAllDeposits = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();
    try {
      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM deposits`
      );
      const total = countResult[0].total;

      const [deposits] = await connection.execute(
        `SELECT 
          d.id,
          d.user_id,
          u.email,
          d.subscription_id,
          d.amount,
          d.crypto_type,
          d.wallet_address,
          d.deposit_reference,
          d.transaction_id,
          d.proof_url,
          d.status,
          d.created_at,
          d.approved_at
         FROM deposits d
         LEFT JOIN users u ON d.user_id = u.id
         ORDER BY d.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({ deposits, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const approveDeposit = async (req, res, next) => {
  try {
    const { id } = req.params; // transaction id
    const connection = await pool.getConnection();
    try {
      const [txRows] = await connection.execute('SELECT id, subscription_id, status FROM transactions WHERE id = ? AND type = ?', [id, 'deposit']);
      if (txRows.length === 0) return res.status(404).json({ error: 'Deposit not found' });
      const tx = txRows[0];
      if (tx.status === 'confirmed') return res.status(400).json({ error: 'Deposit already confirmed' });

      await connection.execute('UPDATE transactions SET status = ?, confirmed_at = NOW() WHERE id = ?', ['confirmed', id]);
      if (tx.subscription_id) {
        await connection.execute('UPDATE subscriptions SET status = ? WHERE id = ?', ['active', tx.subscription_id]);
      }

      res.json({ message: 'Deposit approved successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Admin update wallet addresses but allow only once per 7 days
const adminUpdateWallet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { btc_address, eth_address } = req.body;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute('SELECT last_admin_update FROM wallets WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Wallet not found' });

      const last = rows[0].last_admin_update ? new Date(rows[0].last_admin_update) : null;
      if (last) {
        const diff = Date.now() - last.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        if (days < 7) return res.status(400).json({ error: 'Admin can only change wallet after 7 days since last admin change' });
      }

      await connection.execute('UPDATE wallets SET btc_address = ?, eth_address = ?, last_admin_update = NOW() WHERE id = ?', [btc_address || null, eth_address || null, id]);

      res.json({ message: 'Wallet updated by admin' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getAllContacts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    try {
      const [countResult] = await connection.execute('SELECT COUNT(*) AS total FROM contact_messages');
      const total = countResult[0].total;

      const [contacts] = await connection.execute(
        `SELECT id, name, email, message, status, admin_response, created_at, replied_at
         FROM contact_messages
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({
        contacts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const replyContactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { admin_response } = req.body;

    if (!admin_response || !admin_response.trim()) {
      return res.status(400).json({ error: 'Reply message is required' });
    }

    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute('SELECT id FROM contact_messages WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Contact message not found' });
      }

      await connection.execute(
        `UPDATE contact_messages
         SET admin_response = ?, status = 'replied', replied_at = NOW()
         WHERE id = ?`,
        [admin_response.trim(), id]
      );

      res.json({ message: 'Reply saved successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPlans,
  createPlan,
  updatePlan,
  updatePlanStatus,
  getUserSubscriptions,
  getUserTransactions,
  getUserEarnings,
  getUserWithdrawals,
  getAllUsers,
  getUserDetails,
  getUserKycDocuments,
  allowKycResubmit,
  getPasswordResetRequests,
  getUserPasswordResetRequests,
  updateUser,
  updateUserPassword,
  deleteUser,
  updateUserRole,
  updateUserStatus,
  updateUserKyc,
  forceLogoutUser,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getAllContacts,
  replyContactMessage,
  getDashboardStats
};

// Export additional wallet admin handlers
module.exports.getAllWallets = getAllWallets;
module.exports.getWalletTransactions = getWalletTransactions;
module.exports.updateWalletBalance = updateWalletBalance;
module.exports.adminUpdateWallet = adminUpdateWallet;
module.exports.getAllDeposits = getAllDeposits;
module.exports.approveDeposit = approveDeposit;

// ── Withdrawal & Deposit Statistics ──────────────────────────────────────────
const getFinancialStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Access the underlying pg Pool directly (bypasses the MySQL-compat adapter
    // so we can write native $N params without them being re-numbered per query)
    const rawPg = pool._pgPool;

    // Build date WHERE fragment and params once
    const dateParams = [];
    const dateClauses = [];
    if (from) { dateParams.push(new Date(from)); dateClauses.push(`created_at >= $${dateParams.length}`); }
    if (to)   { dateParams.push(new Date(to));   dateClauses.push(`created_at <= $${dateParams.length}`); }
    const dateWhere  = dateClauses.length ? 'WHERE ' + dateClauses.join(' AND ') : '';
    const trendWhere = dateWhere || "WHERE created_at >= NOW() - INTERVAL '30 days'";
    const trendP     = dateWhere ? [...dateParams] : [];

    // Helper: fresh copy of params for each query so pg never shares array refs
    const p = () => [...dateParams];

    // Run all 7 queries in parallel
    const [wTot, wStat, wCur, wDay, dTot, dStat, dCur] = await Promise.all([
      rawPg.query(`SELECT
          COUNT(*)::int                  AS count,
          COALESCE(SUM(amount),0)        AS total_amount,
          COALESCE(SUM(CASE WHEN status='pending'  THEN amount ELSE 0 END),0) AS pending_amount,
          COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) AS approved_amount,
          COALESCE(SUM(CASE WHEN status='rejected' THEN amount ELSE 0 END),0) AS rejected_amount,
          COUNT(*) FILTER (WHERE status='pending')::int  AS pending_count,
          COUNT(*) FILTER (WHERE status='approved')::int AS approved_count,
          COUNT(*) FILTER (WHERE status='rejected')::int AS rejected_count
        FROM withdrawal_requests ${dateWhere}`, p()),

      rawPg.query(`SELECT status,
          COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total_amount
        FROM withdrawal_requests ${dateWhere}
        GROUP BY status ORDER BY status`, p()),

      rawPg.query(`SELECT COALESCE(crypto_type,'unknown') AS currency,
          COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total_amount
        FROM withdrawal_requests ${dateWhere}
        GROUP BY crypto_type ORDER BY crypto_type`, p()),

      rawPg.query(`SELECT DATE(created_at) AS date,
          COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total_amount
        FROM withdrawal_requests ${trendWhere}
        GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`, trendP),

      rawPg.query(`SELECT
          COUNT(*)::int                  AS count,
          COALESCE(SUM(amount),0)        AS total_amount,
          COALESCE(SUM(CASE WHEN status='pending'  THEN amount ELSE 0 END),0) AS pending_amount,
          COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) AS approved_amount,
          COALESCE(SUM(CASE WHEN status='rejected' THEN amount ELSE 0 END),0) AS rejected_amount,
          COUNT(*) FILTER (WHERE status='pending')::int  AS pending_count,
          COUNT(*) FILTER (WHERE status='approved')::int AS approved_count,
          COUNT(*) FILTER (WHERE status='rejected')::int AS rejected_count
        FROM deposits ${dateWhere}`, p()),

      rawPg.query(`SELECT status,
          COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total_amount
        FROM deposits ${dateWhere}
        GROUP BY status ORDER BY status`, p()),

      rawPg.query(`SELECT COALESCE(crypto_type,'unknown') AS currency,
          COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total_amount
        FROM deposits ${dateWhere}
        GROUP BY crypto_type ORDER BY crypto_type`, p()),
    ]);

    res.json({
      filters: { from: from || null, to: to || null },
      withdrawals: {
        summary:     wTot.rows[0],
        by_status:   wStat.rows,
        by_currency: wCur.rows,
        daily_trend: wDay.rows,
      },
      deposits: {
        summary:     dTot.rows[0],
        by_status:   dStat.rows,
        by_currency: dCur.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getFinancialStats = getFinancialStats;

// ── User Statistics ───────────────────────────────────────────────────────────
const getUserStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rawPg = pool._pgPool;

    const dateParams = [];
    const dateClauses = [];
    if (from) { dateParams.push(new Date(from)); dateClauses.push(`created_at >= $${dateParams.length}`); }
    if (to)   { dateParams.push(new Date(to));   dateClauses.push(`created_at <= $${dateParams.length}`); }
    const dateWhere  = dateClauses.length ? 'WHERE ' + dateClauses.join(' AND ') : '';
    const trendWhere = dateWhere || "WHERE created_at >= NOW() - INTERVAL '30 days'";
    const p = () => [...dateParams];

    const [totRes, roleRes, kycRes, statusRes, countryRes, dailyRes] = await Promise.all([
      rawPg.query(`SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE kyc_verified=true)::int  AS kyc_verified,
          COUNT(*) FILTER (WHERE kyc_verified=false)::int AS kyc_unverified,
          COUNT(*) FILTER (WHERE status='active')::int    AS active,
          COUNT(*) FILTER (WHERE status='suspended')::int AS suspended,
          COUNT(*) FILTER (WHERE role='admin')::int       AS admins,
          COUNT(*) FILTER (WHERE role='user')::int        AS regular_users,
          COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '7 days')::int AS active_last_7d,
          COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '30 days')::int AS active_last_30d
        FROM users ${dateWhere}`, p()),

      rawPg.query(`SELECT role, COUNT(*)::int AS count FROM users ${dateWhere} GROUP BY role ORDER BY count DESC`, p()),

      rawPg.query(`SELECT kyc_verified::text AS kyc_status, COUNT(*)::int AS count FROM users ${dateWhere} GROUP BY kyc_verified`, p()),

      rawPg.query(`SELECT status, COUNT(*)::int AS count FROM users ${dateWhere} GROUP BY status ORDER BY count DESC`, p()),

      rawPg.query(`SELECT COALESCE(country,'Unknown') AS country, COUNT(*)::int AS count
        FROM users ${dateWhere} GROUP BY country ORDER BY count DESC LIMIT 10`, p()),

      rawPg.query(`SELECT DATE(created_at) AS date, COUNT(*)::int AS registrations
        FROM users ${trendWhere}
        GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`, dateWhere ? p() : []),
    ]);

    res.json({
      filters: { from: from || null, to: to || null },
      summary:          totRes.rows[0],
      by_role:          roleRes.rows,
      by_kyc_status:    kycRes.rows,
      by_account_status: statusRes.rows,
      top_countries:    countryRes.rows,
      daily_registrations: dailyRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getUserStats = getUserStats;

// ── Investment Statistics ─────────────────────────────────────────────────────
const getInvestmentStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rawPg = pool._pgPool;

    const params = [];
    const clauses = [];
    if (from) { params.push(new Date(from)); clauses.push(`s.created_at >= $${params.length}`); }
    if (to)   { params.push(new Date(to));   clauses.push(`s.created_at <= $${params.length}`); }
    const sWhere = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

    const eClauses = [];
    const eParams = [];
    if (from) { eParams.push(new Date(from)); eClauses.push(`earned_date >= $${eParams.length}`); }
    if (to)   { eParams.push(new Date(to));   eClauses.push(`earned_date <= $${eParams.length}`); }
    const eWhere = eClauses.length ? 'WHERE ' + eClauses.join(' AND ') : '';
    const eTrend = eWhere || "WHERE earned_date >= NOW() - INTERVAL '30 days'";

    const [summaryRes, byStatusRes, byPlanRes, dailySubRes, earningsSumRes, dailyEarnRes] = await Promise.all([
      rawPg.query(`
        SELECT
          COUNT(*)::int                                          AS total_subscriptions,
          COUNT(*) FILTER (WHERE status='active')::int          AS active,
          COUNT(*) FILTER (WHERE status='completed')::int       AS completed,
          COUNT(*) FILTER (WHERE status='cancelled')::int       AS cancelled,
          COALESCE(SUM(amount),0)::numeric                      AS total_invested,
          COALESCE(SUM(amount) FILTER (WHERE status='active'),0)::numeric AS active_invested
        FROM subscriptions s ${sWhere}`, [...params]),

      rawPg.query(`
        SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric AS total_amount
        FROM subscriptions s ${sWhere} GROUP BY status ORDER BY count DESC`, [...params]),

      rawPg.query(`
        SELECT p.name AS plan_name, p.daily_profit_percentage,
          COUNT(s.id)::int AS subscriptions,
          COALESCE(SUM(s.amount),0)::numeric AS total_invested,
          COUNT(s.id) FILTER (WHERE s.status='active')::int AS active_count
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        ${sWhere}
        GROUP BY p.id, p.name, p.daily_profit_percentage
        ORDER BY total_invested DESC`, [...params]),

      rawPg.query(`
        SELECT DATE(s.created_at) AS date, COUNT(*)::int AS new_subscriptions,
          COALESCE(SUM(s.amount),0)::numeric AS amount_invested
        FROM subscriptions s
        ${sWhere || "WHERE s.created_at >= NOW() - INTERVAL '30 days'"}
        GROUP BY DATE(s.created_at) ORDER BY date DESC LIMIT 30`, sWhere ? [...params] : []),

      rawPg.query(`
        SELECT
          COALESCE(SUM(amount),0)::numeric AS total_earnings_paid,
          COUNT(*)::int                    AS total_earning_records,
          COALESCE(SUM(amount) FILTER (WHERE transferred_to_wallet=true),0)::numeric AS transferred_to_wallet
        FROM earnings ${eWhere}`, [...eParams]),

      rawPg.query(`
        SELECT earned_date AS date, COUNT(*)::int AS records, COALESCE(SUM(amount),0)::numeric AS total_amount
        FROM earnings ${eTrend}
        GROUP BY earned_date ORDER BY earned_date DESC LIMIT 30`, eWhere ? [...eParams] : []),
    ]);

    res.json({
      filters: { from: from || null, to: to || null },
      summary:              summaryRes.rows[0],
      by_status:            byStatusRes.rows,
      by_plan:              byPlanRes.rows,
      daily_subscriptions:  dailySubRes.rows,
      earnings: {
        summary:      earningsSumRes.rows[0],
        daily_trend:  dailyEarnRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getInvestmentStats = getInvestmentStats;

// ── Referral Statistics ───────────────────────────────────────────────────────
const getReferralStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rawPg = pool._pgPool;

    const rParams = [], rClauses = [];
    const cParams = [], cClauses = [];
    if (from) {
      rParams.push(new Date(from)); rClauses.push(`r.created_at >= $${rParams.length}`);
      cParams.push(new Date(from)); cClauses.push(`rc.created_at >= $${cParams.length}`);
    }
    if (to) {
      rParams.push(new Date(to)); rClauses.push(`r.created_at <= $${rParams.length}`);
      cParams.push(new Date(to)); cClauses.push(`rc.created_at <= $${cParams.length}`);
    }
    const rWhere = rClauses.length ? 'WHERE ' + rClauses.join(' AND ') : '';
    const cWhere = cClauses.length ? 'WHERE ' + cClauses.join(' AND ') : '';
    const dailyWhere = rWhere || "WHERE r.created_at >= NOW() - INTERVAL '30 days'";

    const [summaryRes, commSumRes, byStatusRes, topRes, dailyRes] = await Promise.all([
      rawPg.query(`
        SELECT
          COUNT(*)::int                                        AS total_referrals,
          COUNT(*) FILTER (WHERE r.status='converted')::int   AS converted,
          COUNT(*) FILTER (WHERE r.status='pending')::int     AS pending,
          COUNT(DISTINCT r.referrer_id)::int                  AS unique_referrers
        FROM referrals r ${rWhere}`, [...rParams]),

      rawPg.query(`
        SELECT
          COALESCE(SUM(rc.amount),0)::numeric                                         AS total_commissions,
          COALESCE(SUM(rc.amount) FILTER (WHERE rc.status='paid'),0)::numeric         AS paid,
          COALESCE(SUM(rc.amount) FILTER (WHERE rc.status='pending'),0)::numeric      AS pending,
          COUNT(*)::int                                                                AS total_records,
          COUNT(*) FILTER (WHERE rc.status='paid')::int                               AS paid_count,
          COUNT(*) FILTER (WHERE rc.status='pending')::int                            AS pending_count
        FROM referral_commissions rc ${cWhere}`, [...cParams]),

      rawPg.query(`
        SELECT rc.status, COUNT(*)::int AS count, COALESCE(SUM(rc.amount),0)::numeric AS total_amount
        FROM referral_commissions rc ${cWhere} GROUP BY rc.status ORDER BY count DESC`, [...cParams]),

      rawPg.query(`
        SELECT u.id, u.email, u.first_name, u.last_name,
          COUNT(r.id)::int AS referrals_count,
          COUNT(r.id) FILTER (WHERE r.status='converted')::int AS converted_count,
          COALESCE(SUM(rc.amount),0)::numeric AS total_commission_earned
        FROM referrals r
        JOIN users u ON u.id = r.referrer_id
        LEFT JOIN referral_commissions rc ON rc.referrer_id = r.referrer_id
        ${rWhere}
        GROUP BY u.id, u.email, u.first_name, u.last_name
        ORDER BY referrals_count DESC LIMIT 10`, [...rParams]),

      rawPg.query(`
        SELECT DATE(r.created_at) AS date, COUNT(*)::int AS new_referrals,
          COUNT(*) FILTER (WHERE r.status='converted')::int AS converted
        FROM referrals r ${dailyWhere}
        GROUP BY DATE(r.created_at) ORDER BY date DESC LIMIT 30`,
        rWhere ? [...rParams] : []),
    ]);

    res.json({
      filters: { from: from || null, to: to || null },
      summary:              summaryRes.rows[0],
      commissions:          { summary: commSumRes.rows[0], by_status: byStatusRes.rows },
      top_referrers:        topRes.rows,
      daily_referrals:      dailyRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getReferralStats = getReferralStats;

