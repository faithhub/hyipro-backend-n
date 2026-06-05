const pool = require('../config/database');

const getCompanyWallets = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [wallets] = await connection.execute(
        'SELECT id, btc_address, eth_address, created_at, updated_at FROM company_wallets LIMIT 1'
      );

      if (wallets.length === 0) {
        return res.status(404).json({ error: 'Company wallets not configured' });
      }

      res.json({ wallet: wallets[0] });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const updateCompanyWallets = async (req, res, next) => {
  try {
    const { btc_address, eth_address } = req.body;

    if (!btc_address || !eth_address) {
      return res.status(400).json({ error: 'Both BTC and ETH addresses are required' });
    }

    const btcRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;

    if (!btcRegex.test(btc_address)) {
      return res.status(400).json({ error: 'Invalid BTC address format' });
    }

    if (!ethRegex.test(eth_address)) {
      return res.status(400).json({ error: 'Invalid ETH address format' });
    }

    const connection = await pool.getConnection();
    try {
      const [existing] = await connection.execute(
        'SELECT id FROM company_wallets LIMIT 1'
      );

      if (existing.length === 0) {
        await connection.execute(
          'INSERT INTO company_wallets (btc_address, eth_address) VALUES (?, ?)',
          [btc_address, eth_address]
        );
      } else {
        await connection.execute(
          'UPDATE company_wallets SET btc_address = ?, eth_address = ?, updated_at = NOW() WHERE id = ?',
          [btc_address, eth_address, existing[0].id]
        );
      }

      res.json({ message: 'Company wallets updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanyWallets,
  updateCompanyWallets
};
