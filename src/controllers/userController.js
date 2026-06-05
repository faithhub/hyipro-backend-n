const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const path = require('path');
const { logAudit } = require('../utils/auditLog');

const getSystemSetting = async (key) => {
  const connection = await pool.getConnection();
  try {
    const [settings] = await connection.execute(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [key]
    );
    return settings.length > 0 ? parseFloat(settings[0].setting_value) : null;
  } finally {
    connection.release();
  }
};

const getProfile = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute(
        'SELECT id, email, first_name, last_name, phone, country, kyc_verified, role, created_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: users[0] });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { first_name, last_name, phone, country } = req.body;
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE users SET first_name = ?, last_name = ?, phone = ?, country = ? WHERE id = ?',
        [first_name || null, last_name || null, phone || null, country || null, req.user.id]
      );

      res.json({ message: 'Profile updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute(
        'SELECT password_hash FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const passwordMatch = await bcrypt.compare(currentPassword, users[0].password_hash);

      if (!passwordMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await connection.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, req.user.id]
      );

      logAudit(req, 'user.password_changed', { userId: req.user.id, entityType: 'user', entityId: req.user.id });

      res.json({ message: 'Password changed successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getWallet = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [wallets] = await connection.execute(
        'SELECT id, btc_address, eth_address FROM wallets WHERE user_id = ?',
        [req.user.id]
      );

      if (wallets.length === 0) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      res.json({ wallet: wallets[0] });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getWalletBalance = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [wallets] = await connection.execute(
        'SELECT balance FROM wallets WHERE user_id = ?',
        [req.user.id]
      );

      if (wallets.length === 0) {
        // Create wallet with 0 balance if doesn't exist
        await connection.execute(
          'INSERT INTO wallets (user_id, balance) VALUES (?, 0)',
          [req.user.id]
        );
        return res.json({ balance: 0 });
      }

      res.json({ balance: parseFloat(wallets[0].balance) || 0 });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updateWallet = async (req, res, next) => {
  try {
    const { btc_address, eth_address } = req.body;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute('SELECT last_user_update FROM wallets WHERE user_id = ?', [req.user.id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const lastUpdate = rows[0].last_user_update ? new Date(rows[0].last_user_update) : null;
      if (lastUpdate) {
        const diffMs = Date.now() - lastUpdate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays < 7) {
          return res.status(400).json({ error: 'You can only update your wallet once every 7 days' });
        }
      }

      await connection.execute(
        'UPDATE wallets SET btc_address = ?, eth_address = ?, last_user_update = NOW() WHERE user_id = ?',
        [btc_address || null, eth_address || null, req.user.id]
      );

      res.json({ message: 'Wallet updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getSubscriptions = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [subscriptions] = await connection.execute(
        `SELECT s.id, s.plan_id, p.name, p.daily_profit_percentage, p.duration_days, 
                s.amount, s.start_date, s.end_date, s.status 
         FROM subscriptions s 
         JOIN plans p ON s.plan_id = p.id 
         WHERE s.user_id = ? 
         ORDER BY s.created_at DESC`,
        [req.user.id]
      );

      res.json({ subscriptions });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getActiveSubscriptions = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [activeSubscriptions] = await connection.execute(
        `SELECT s.id, s.plan_id, p.name, p.daily_profit_percentage, p.duration_days,
                s.amount, s.start_date, s.end_date, s.status, s.user_id,
                CONCAT(u.first_name, ' ', u.last_name) AS owner_name,
                u.email,
                CASE WHEN s.user_id = ? THEN 1 ELSE 0 END AS is_owner
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         JOIN users u ON s.user_id = u.id
         WHERE s.status = 'active' AND s.user_id = ?
         ORDER BY s.created_at DESC`,
        [req.user.id, req.user.id]
      );

      res.json({ activeSubscriptions });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getEarnings = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [earnings] = await connection.execute(
        `SELECT e.id, e.subscription_id, e.amount, e.earned_date, e.transferred_to_wallet,
                s.plan_id, p.name as plan_name
         FROM earnings e 
         JOIN subscriptions s ON e.subscription_id = s.id 
         JOIN plans p ON s.plan_id = p.id 
         WHERE s.user_id = ? 
         ORDER BY e.earned_date DESC`,
        [req.user.id]
      );

      const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.amount), 0);

      res.json({ earnings, totalEarnings });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      // Get transactions from transactions table
      const [transactions] = await connection.execute(
        `SELECT t.id, t.type, t.crypto_type, t.amount, t.status, t.tx_hash, t.created_at, t.confirmed_at,
                p.name AS plan_name
         FROM transactions t
         LEFT JOIN subscriptions s ON t.subscription_id = s.id
         LEFT JOIN plans p ON s.plan_id = p.id
         WHERE t.user_id = ? 
         ORDER BY t.created_at DESC`,
        [req.user.id]
      );

      // Get deposits from deposits table
      const [deposits] = await connection.execute(
        `SELECT id, 'deposit' AS type, crypto_type, amount, status, created_at, approved_at AS confirmed_at,
                NULL AS plan_name, NULL AS tx_hash
         FROM deposits
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      // Get withdrawals from withdrawal_requests table
      const [withdrawals] = await connection.execute(
        `SELECT id, 'withdrawal' AS type, crypto_type, amount, status, created_at, processed_at AS confirmed_at,
                NULL AS plan_name, sent_tx_id AS tx_hash
         FROM withdrawal_requests
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      // Get earnings from earnings table
      const [earnings] = await connection.execute(
        `SELECT e.id, 'earnings' AS type, NULL AS crypto_type, e.amount, 'completed' AS status, e.earned_date AS created_at, e.earned_date AS confirmed_at,
                p.name AS plan_name, NULL AS tx_hash
         FROM earnings e
         LEFT JOIN subscriptions s ON e.subscription_id = s.id
         LEFT JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ?
         ORDER BY e.earned_date DESC`,
        [req.user.id]
      );

      // Combine all transactions
      const allTransactions = [
        ...transactions.map(t => ({ ...t, source: 'transactions' })),
        ...deposits.map(d => ({ ...d, source: 'deposits' })),
        ...withdrawals.map(w => ({ ...w, source: 'withdrawals' })),
        ...earnings.map(e => ({ ...e, source: 'earnings' }))
      ];

      // Sort by created_at DESC
      allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.json({ transactions: allTransactions });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getKycStatus = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute(
        'SELECT kyc_verified FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const [documents] = await connection.execute(
        `SELECT id, document_type, file_path, status, admin_notes, submitted_at, reviewed_at, allow_resubmit
         FROM kyc_documents
         WHERE user_id = ?
         ORDER BY submitted_at DESC`,
        [req.user.id]
      );

      res.json({
        kyc_verified: !!users[0].kyc_verified,
        documents,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const uploadKycDocument = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const { document_type } = req.body;
      if (!document_type) {
        return res.status(400).json({ error: 'document_type is required' });
      }

      const allowedTypes = ['id_card', 'passport', 'drivers_license'];
      if (!allowedTypes.includes(document_type)) {
        return res.status(400).json({ error: 'Invalid document_type' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Document file is required' });
      }

      // Prevent re-upload if there is an existing pending or approved document, or rejected without allow_resubmit
      const [existing] = await connection.execute(
        `SELECT id, status, allow_resubmit FROM kyc_documents WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 1`,
        [req.user.id]
      );

      if (existing.length > 0) {
        const latest = existing[0];
        if (latest.status === 'pending' || latest.status === 'approved') {
          return res.status(400).json({ error: 'KYC already submitted. Please wait for review.' });
        }
        if (latest.status === 'rejected' && !latest.allow_resubmit) {
          return res.status(400).json({ error: 'Re-upload not allowed yet. Please contact support or wait for admin permission.' });
        }
      }

      const filePath = `uploads/kyc/${req.file.filename}`.replace(/\\/g, '/');

      await connection.execute(
        'INSERT INTO kyc_documents (user_id, document_type, file_path, status) VALUES (?, ?, ?, ?)',
        [req.user.id, document_type, filePath, 'pending']
      );

      // reset allow_resubmit on new submission
      await connection.execute('UPDATE kyc_documents SET allow_resubmit = 0 WHERE user_id = ?', [req.user.id]);

      // When user submits, ensure user's kyc_verified flag is false
      await connection.execute('UPDATE users SET kyc_verified = ? WHERE id = ?', [false, req.user.id]);

      logAudit(req, 'user.kyc_submitted', { userId: req.user.id, entityType: 'user', entityId: req.user.id, metadata: { document_type } });

      res.status(201).json({ message: 'KYC document submitted successfully', document: { document_type, file_path: filePath, status: 'pending' } });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const createSubscription = async (req, res, next) => {
  try {
    const { plan_id, amount } = req.body;
    const userId = req.user.id;

    if (!plan_id || !amount) {
      return res.status(400).json({ error: 'plan_id and amount are required' });
    }

    const connection = await pool.getConnection();
    try {
      // Get plan details
      const [plans] = await connection.execute(
        'SELECT id, min_deposit, max_deposit, duration_days FROM plans WHERE id = ?',
        [plan_id]
      );

      if (plans.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const plan = plans[0];
      const investAmount = parseFloat(amount);

      // Validate amount
      if (investAmount < plan.min_deposit || investAmount > plan.max_deposit) {
        return res.status(400).json({ 
          error: `Amount must be between $${plan.min_deposit} and $${plan.max_deposit}` 
        });
      }

      // Get user's wallet balance
      const [wallets] = await connection.execute(
        'SELECT balance FROM wallets WHERE user_id = ?',
        [userId]
      );

      if (wallets.length === 0 || wallets[0].balance < investAmount) {
        return res.status(400).json({ error: 'Insufficient wallet balance' });
      }

      // Create subscription
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

      const [result] = await connection.execute(
        `INSERT INTO subscriptions (user_id, plan_id, amount, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [userId, plan_id, investAmount, startDate, endDate]
      );

      // Deduct from wallet balance
      const currentBalance = wallets[0].balance;
      const newBalance = currentBalance - investAmount;
      
      await connection.execute(
        'UPDATE wallets SET balance = ? WHERE user_id = ?',
        [newBalance, userId]
      );

      res.status(201).json({ 
        message: 'Subscription created successfully',
        subscription: {
          id: result.insertId,
          plan_id,
          amount: investAmount,
          start_date: startDate,
          end_date: endDate,
          status: 'active'
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const createWithdrawal = async (req, res, next) => {
  try {
    const { amount, crypto_type, wallet_address } = req.body;
    const userId = req.user.id;

    if (!amount || !crypto_type || !wallet_address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    // Min withdrawal: $10, Max withdrawal: $50,000
    const MIN_WITHDRAWAL = await getSystemSetting('MIN_WITHDRAWAL') || 1000;
    const MAX_WITHDRAWAL = await getSystemSetting('MAX_WITHDRAWAL') || 50000;

    if (withdrawAmount < MIN_WITHDRAWAL) {
      return res.status(400).json({ error: `Minimum withdrawal amount is $${MIN_WITHDRAWAL}` });
    }

    if (withdrawAmount > MAX_WITHDRAWAL) {
      return res.status(400).json({ error: `Maximum withdrawal amount is $${MAX_WITHDRAWAL}` });
    }

    const connection = await pool.getConnection();
    try {
      // Check if user is KYC verified
      const [users] = await connection.execute(
        'SELECT kyc_verified FROM users WHERE id = ?',
        [userId]
      );

      if (!users.length || !users[0].kyc_verified) {
        return res.status(403).json({ error: 'KYC verification required for withdrawals' });
      }

      // Get wallet balance
      const [wallets] = await connection.execute(
        'SELECT balance FROM wallets WHERE user_id = ?',
        [userId]
      );

      if (!wallets.length) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const walletBalance = parseFloat(wallets[0].balance);

      // Validate wallet balance
      if (withdrawAmount > walletBalance) {
        return res.status(400).json({ error: 'Insufficient wallet balance' });
      }

      // Get crypto price and calculate crypto amount
      const cryptoPriceService = require('../services/cryptoPriceService');
      const prices = await cryptoPriceService.getPrices();
      const cryptoPrice = prices[crypto_type];
      const cryptoAmount = withdrawAmount / cryptoPrice;

      // Create withdrawal request with crypto_amount
      const [result] = await connection.execute(
        `INSERT INTO withdrawal_requests 
         (user_id, amount, crypto_amount, crypto_type, wallet_address, status, created_at) 
         VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
        [userId, withdrawAmount, cryptoAmount, crypto_type, wallet_address]
      );

      // Deduct from wallet balance
      const newBalance = walletBalance - withdrawAmount;
      await connection.execute(
        'UPDATE wallets SET balance = ? WHERE user_id = ?',
        [newBalance, userId]
      );

      res.status(201).json({
        message: 'Withdrawal request created successfully',
        withdrawal: {
          id: result.insertId,
          amount: withdrawAmount,
          crypto_amount: cryptoAmount,
          crypto_type,
          wallet_address,
          status: 'pending',
          created_at: new Date()
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getWithdrawalRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const connection = await pool.getConnection();

    try {
      const [withdrawals] = await connection.execute(
        `SELECT id, amount, crypto_amount, crypto_type, wallet_address, status, sent_tx_id, rejection_reason, created_at, processed_at
         FROM withdrawal_requests
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({ withdrawals });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const transferEarningsToWallet = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get user's untransferred earnings
      const [earnings] = await connection.execute(
        `SELECT e.id, e.amount, s.user_id
         FROM earnings e
         JOIN subscriptions s ON e.subscription_id = s.id
         WHERE s.user_id = ? AND e.transferred_to_wallet = FALSE`,
        [req.user.id]
      );

      if (earnings.length === 0) {
        await connection.rollback();
        return res.json({ message: 'No earnings to transfer', transferredAmount: 0 });
      }

      // Calculate total amount
      const totalAmount = earnings.reduce((sum, earning) => sum + parseFloat(earning.amount), 0);

      // Update wallet balance
      await connection.execute(
        `INSERT INTO wallets (user_id, balance) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE balance = balance + ?`,
        [req.user.id, totalAmount, totalAmount]
      );

      // Mark earnings as transferred
      const earningIds = earnings.map(e => e.id);
      await connection.execute(
        `UPDATE earnings SET transferred_to_wallet = TRUE, transferred_at = NOW()
         WHERE id IN (${earningIds.map(() => '?').join(',')})`,
        earningIds
      );

      await connection.commit();

      res.json({
        message: 'Earnings transferred to wallet successfully',
        transferredAmount: totalAmount,
        earningsCount: earnings.length
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getWallet,
  getWalletBalance,
  updateWallet,
  getSubscriptions,
  getActiveSubscriptions,
  createSubscription,
  getEarnings,
  transferEarningsToWallet,
  getTransactions,
  getKycStatus,
  uploadKycDocument,
  createWithdrawal,
  getWithdrawalRequests,
};
