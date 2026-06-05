const pool = require('../config/database');

const getCompanyWalletAddress = async (cryptoType) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [wallets] = await connection.execute(
        'SELECT btc_address, eth_address FROM company_wallets LIMIT 1'
      );
      
      if (wallets.length === 0) {
        throw new Error('Company wallet addresses not configured');
      }
      
      const wallet = wallets[0];
      
      if (cryptoType === 'BTC') {
        return wallet.btc_address;
      } else if (cryptoType === 'ETH') {
        return wallet.eth_address;
      }
      
      throw new Error('Invalid crypto type');
    } finally {
      connection.release();
    }
  } catch (error) {
    throw new Error(`Failed to get company wallet: ${error.message}`);
  }
};

const createDepositRequest = async (userId, subscriptionId, cryptoType, amount, depositReference) => {
  try {
    const connection = await pool.getConnection();
    try {
      let walletAddress = '';
      
      try {
        walletAddress = await getCompanyWalletAddress(cryptoType);
      } catch (error) {
        // If company wallet not configured, use placeholder
        walletAddress = cryptoType === 'BTC' ? 'BTC_ADDRESS_NOT_CONFIGURED' : 'ETH_ADDRESS_NOT_CONFIGURED';
      }
      
      const subscriptionIdValue = subscriptionId && subscriptionId > 0 ? subscriptionId : null;
      const [result] = await connection.execute(
        `INSERT INTO deposits (user_id, subscription_id, crypto_type, amount, wallet_address, deposit_reference, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, subscriptionIdValue, cryptoType, amount, walletAddress, depositReference]
      );
      
      return {
        id: result.insertId,
        wallet_address: walletAddress,
        crypto_type: cryptoType,
        amount,
        status: 'pending'
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    throw new Error(`Failed to create deposit request: ${error.message}`);
  }
};

const uploadDepositProof = async (depositId, userId, proofUrl, transactionId) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [deposits] = await connection.execute(
        'SELECT id FROM deposits WHERE id = ? AND user_id = ? AND status = ?',
        [depositId, userId, 'pending']
      );
      
      if (deposits.length === 0) {
        throw new Error('Deposit not found or already processed');
      }
      
      await connection.execute(
        `UPDATE deposits SET proof_url = ?, transaction_id = ?, status = 'awaiting_approval', proof_uploaded_at = NOW()
         WHERE id = ?`,
        [proofUrl, transactionId, depositId]
      );
      
      return { message: 'Proof uploaded successfully' };
    } finally {
      connection.release();
    }
  } catch (error) {
    throw new Error(`Failed to upload deposit proof: ${error.message}`);
  }
};

const getDepositStatus = async (depositId, userId) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [deposits] = await connection.execute(
        `SELECT id, crypto_type, amount, wallet_address, status, transaction_id, proof_url, created_at, approved_at
         FROM deposits
         WHERE id = ? AND user_id = ?`,
        [depositId, userId]
      );
      
      if (deposits.length === 0) {
        throw new Error('Deposit not found');
      }
      
      return deposits[0];
    } finally {
      connection.release();
    }
  } catch (error) {
    throw new Error(`Failed to get deposit status: ${error.message}`);
  }
};

const getUserPendingDeposits = async (userId) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [deposits] = await connection.execute(
        `SELECT id, crypto_type, amount, wallet_address, status, transaction_id, created_at, approved_at, proof_url, rejection_reason
         FROM deposits
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      );
      
      return deposits;
    } finally {
      connection.release();
    }
  } catch (error) {
    throw new Error(`Failed to get pending deposits: ${error.message}`);
  }
};

const addToWalletBalance = async (userId, amount) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [wallets] = await connection.execute(
        'SELECT id, balance FROM wallets WHERE user_id = ?',
        [userId]
      );

      if (wallets.length === 0) {
        // Create wallet if doesn't exist
        await connection.execute(
          'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
          [userId, amount]
        );
      } else {
        // Update existing wallet
        const newBalance = parseFloat(wallets[0].balance) + parseFloat(amount);
        await connection.execute(
          'UPDATE wallets SET balance = ? WHERE user_id = ?',
          [newBalance, userId]
        );
      }

      return { message: 'Wallet balance updated' };
    } finally {
      connection.release();
    }
  } catch (error) {
    throw new Error(`Failed to add to wallet balance: ${error.message}`);
  }
};

module.exports = {
  getCompanyWalletAddress,
  createDepositRequest,
  uploadDepositProof,
  getDepositStatus,
  getUserPendingDeposits,
  addToWalletBalance
};
