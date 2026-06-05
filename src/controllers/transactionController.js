const pool = require('../config/database');
const crypto = require('crypto');
const { validateWalletAddress, generateDepositReference } = require('../utils/walletValidator');
const { createDepositRequest, uploadDepositProof, getDepositStatus, getUserPendingDeposits, addToWalletBalance } = require('../utils/walletService');

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

const initiateDeposit = async (req, res, next) => {
  try {
    const { subscription_id, crypto_type, amount, is_wallet_deposit } = req.body;

    if (!crypto_type) {
      return res.status(400).json({ error: 'crypto_type is required' });
    }

    if (!['BTC', 'ETH'].includes(crypto_type)) {
      return res.status(400).json({ error: 'crypto_type must be BTC or ETH' });
    }

    let depositAmount = amount || 0;

    // Validate deposit amount for wallet deposits
    if (is_wallet_deposit) {
      const MIN_DEPOSIT = await getSystemSetting('MIN_DEPOSIT') || 50;
      const MAX_DEPOSIT = await getSystemSetting('MAX_DEPOSIT') || 5000;

      if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
      }

      if (depositAmount < MIN_DEPOSIT) {
        return res.status(400).json({ error: `Minimum deposit amount is $${MIN_DEPOSIT}` });
      }

      if (depositAmount > MAX_DEPOSIT) {
        return res.status(400).json({ error: `Maximum deposit amount is $${MAX_DEPOSIT}` });
      }
    }

    // If not a wallet deposit, require subscription_id and fetch amount from subscription
    if (!is_wallet_deposit) {
      if (!subscription_id) {
        return res.status(400).json({ error: 'subscription_id is required for subscription deposits' });
      }

      const connection = await pool.getConnection();

      try {
        const [subscriptions] = await connection.execute(
          'SELECT id, amount FROM subscriptions WHERE id = ? AND user_id = ?',
          [subscription_id, req.user.id]
        );

        if (subscriptions.length === 0) {
          return res.status(404).json({ error: 'Subscription not found' });
        }

        depositAmount = subscriptions[0].amount;
      } finally {
        connection.release();
      }
    }

    const depositRequest = await createDepositRequest(
      req.user.id,
      is_wallet_deposit ? null : subscription_id,
      crypto_type,
      depositAmount,
      generateDepositReference()
    );

    res.status(201).json({
      deposit_id: depositRequest.id,
      wallet_address: depositRequest.wallet_address,
      amount_expected: depositRequest.amount,
      crypto_type: depositRequest.crypto_type,
      status: depositRequest.status,
      message: 'Send crypto to the provided address. Upload proof and transaction ID once sent.'
    });
  } catch (error) {
    next(error);
  }
};

const getDepositById = async (req, res, next) => {
  try {
    const { depositId } = req.params;

    const deposit = await getDepositStatus(depositId, req.user.id);

    res.json({
      deposit_id: deposit.id,
      deposit_reference: deposit.deposit_reference,
      crypto_type: deposit.crypto_type,
      amount: deposit.amount,
      wallet_address: deposit.wallet_address,
      status: deposit.status,
      transaction_id: deposit.transaction_id,
      proof_url: deposit.proof_url,
      created_at: deposit.created_at,
      approved_at: deposit.approved_at
    });
  } catch (error) {
    next(error);
  }
};

const uploadProof = async (req, res, next) => {
  try {
    const { depositId } = req.params;
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'proof_image file is required' });
    }

    const proofPath = `/uploads/proofs/${req.file.filename}`;

    await uploadDepositProof(depositId, req.user.id, proofPath, transaction_id);

    res.json({ message: 'Proof uploaded successfully. Awaiting admin approval.', proof_url: proofPath });
  } catch (error) {
    next(error);
  }
};

const getPendingDeposits = async (req, res, next) => {
  try {
    const deposits = await getUserPendingDeposits(req.user.id);

    res.json({ deposits });
  } catch (error) {
    next(error);
  }
};

const adminConfirmDeposit = async (req, res, next) => {
  try {
    const { depositId } = req.params;
    const { approvedAmount } = req.body;
    const connection = await pool.getConnection();

    try {
      const [deposits] = await connection.execute(
        'SELECT id, user_id, subscription_id, amount, status FROM deposits WHERE id = ? AND status = ?',
        [depositId, 'awaiting_approval']
      );

      if (deposits.length === 0) {
        return res.status(404).json({ error: 'Deposit not found or already processed' });
      }

      const deposit = deposits[0];
      const finalAmount = approvedAmount !== undefined ? approvedAmount : deposit.amount;

      await connection.execute(
        'UPDATE deposits SET status = ?, approved_at = NOW(), amount = ? WHERE id = ?',
        ['approved', finalAmount, depositId]
      );

      if (deposit.subscription_id) {
        await connection.execute(
          'UPDATE subscriptions SET status = ? WHERE id = ?',
          ['active', deposit.subscription_id]
        );
      }

      // Add approved amount to user's wallet balance
      await addToWalletBalance(deposit.user_id, finalAmount);

      res.json({ message: 'Deposit approved successfully and added to wallet balance' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const adminRejectDeposit = async (req, res, next) => {
  try {
    const { depositId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'rejection_reason is required' });
    }

    const connection = await pool.getConnection();

    try {
      const [deposits] = await connection.execute(
        'SELECT id FROM deposits WHERE id = ? AND status = ?',
        [depositId, 'awaiting_approval']
      );

      if (deposits.length === 0) {
        return res.status(404).json({ error: 'Deposit not found or already processed' });
      }

      await connection.execute(
        'UPDATE deposits SET status = ?, rejection_reason = ?, rejected_at = NOW() WHERE id = ?',
        ['rejected', reason, depositId]
      );

      res.json({ message: 'Deposit rejected' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const requestWithdrawal = async (req, res, next) => {
  try {
    const { subscription_id, crypto_type, wallet_address } = req.body;

    if (!subscription_id || !crypto_type || !wallet_address) {
      return res.status(400).json({ error: 'subscription_id, crypto_type, and wallet_address are required' });
    }

    if (!['BTC', 'ETH'].includes(crypto_type)) {
      return res.status(400).json({ error: 'crypto_type must be BTC or ETH' });
    }

    if (!validateWalletAddress(wallet_address, crypto_type)) {
      return res.status(400).json({ error: `Invalid ${crypto_type} wallet address format` });
    }

    const connection = await pool.getConnection();

    try {
      const [userRows] = await connection.execute('SELECT kyc_verified FROM users WHERE id = ?', [req.user.id]);
      if (userRows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (!userRows[0].kyc_verified) {
        return res.status(403).json({ error: 'KYC not verified. Withdrawals are not allowed.' });
      }

      const [subscriptions] = await connection.execute(
        `SELECT s.id, s.amount, s.end_date, s.status 
         FROM subscriptions s 
         WHERE s.id = ? AND s.user_id = ?`,
        [subscription_id, req.user.id]
      );

      if (subscriptions.length === 0) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      const subscription = subscriptions[0];
      const now = new Date();
      const endDate = new Date(subscription.end_date);

      if (now < endDate) {
        return res.status(400).json({ error: 'Subscription has not matured yet' });
      }

      const [earnings] = await connection.execute(
        'SELECT SUM(amount) as total_earnings FROM earnings WHERE subscription_id = ?',
        [subscription_id]
      );

      const totalEarnings = earnings[0].total_earnings || 0;
      const withdrawalAmount = parseFloat(subscription.amount) + parseFloat(totalEarnings);

      const [result] = await connection.execute(
        `INSERT INTO withdrawal_requests (user_id, subscription_id, amount, crypto_type, wallet_address, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [req.user.id, subscription_id, withdrawalAmount, crypto_type, wallet_address]
      );

      res.status(201).json({
        message: 'Withdrawal request created',
        withdrawal_request: {
          id: result.insertId,
          subscription_id,
          amount: withdrawalAmount,
          crypto_type,
          wallet_address,
          status: 'pending'
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
    const connection = await pool.getConnection();

    try {
      const [requests] = await connection.execute(
        `SELECT id, subscription_id, amount, crypto_type, wallet_address, status, created_at, processed_at 
         FROM withdrawal_requests 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      res.json({ withdrawal_requests: requests });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const adminApproveWithdrawal = async (req, res, next) => {
  try {
    const { withdrawalId } = req.params;
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id is required' });
    }

    const connection = await pool.getConnection();

    try {
      const [withdrawals] = await connection.execute(
        'SELECT id, user_id FROM withdrawal_requests WHERE id = ? AND status = ?',
        [withdrawalId, 'pending']
      );

      if (withdrawals.length === 0) {
        return res.status(404).json({ error: 'Withdrawal request not found or already processed' });
      }

      await connection.execute(
        'UPDATE withdrawal_requests SET status = ?, sent_tx_id = ?, processed_at = NOW() WHERE id = ?',
        ['completed', transaction_id, withdrawalId]
      );

      res.json({ message: 'Withdrawal approved and processed successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const adminRejectWithdrawal = async (req, res, next) => {
  try {
    const { withdrawalId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'rejection_reason is required' });
    }

    const connection = await pool.getConnection();

    try {
      const [withdrawals] = await connection.execute(
        'SELECT id, user_id, amount FROM withdrawal_requests WHERE id = ? AND status = ?',
        [withdrawalId, 'pending']
      );

      if (withdrawals.length === 0) {
        return res.status(404).json({ error: 'Withdrawal request not found or already processed' });
      }

      const userId = withdrawals[0].user_id;
      const amount = parseFloat(withdrawals[0].amount);

      // Return amount to wallet
      await connection.execute(
        'UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
        [amount, userId]
      );

      // Update withdrawal status
      await connection.execute(
        'UPDATE withdrawal_requests SET status = ?, rejection_reason = ?, processed_at = NOW() WHERE id = ?',
        ['rejected', reason, withdrawalId]
      );

      res.json({ message: 'Withdrawal rejected and amount returned to wallet' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getProofFile = async (req, res, next) => {
  try {
    const { depositId } = req.params;
    const connection = await pool.getConnection();

    try {
      // Verify user has access to this deposit
      const [deposits] = await connection.execute(
        'SELECT id, user_id, proof_url FROM deposits WHERE id = ?',
        [depositId]
      );

      if (deposits.length === 0) {
        return res.status(404).json({ error: 'Deposit not found' });
      }

      const deposit = deposits[0];

      // Check if user is owner or admin
      if (deposit.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!deposit.proof_url) {
        return res.status(404).json({ error: 'No proof uploaded for this deposit' });
      }

      // Extract filename from proof_url and serve it
      const filename = deposit.proof_url.split('/').pop();
      const path = require('path');
      const fs = require('fs');

      const roots = [
        path.join(__dirname, '../../uploads/proofs'),
        path.join(__dirname, '../../../uploads/proofs')
      ];

      let fileFound = false;
      for (const root of roots) {
        const filePath = path.join(root, filename);
        if (fs.existsSync(filePath)) {
          res.download(filePath, filename);
          fileFound = true;
          break;
        }
      }

      if (!fileFound) {
        return res.status(404).json({ error: 'Proof file not found' });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateDeposit,
  getDepositById,
  uploadProof,
  getPendingDeposits,
  adminConfirmDeposit,
  adminRejectDeposit,
  requestWithdrawal,
  getWithdrawalRequests,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  getProofFile
};
