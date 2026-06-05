require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const createTables = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Creating database tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        country VARCHAR(100),
        kyc_verified BOOLEAN DEFAULT FALSE,
        role VARCHAR(10) DEFAULT 'user',
        status VARCHAR(10) DEFAULT 'active',
        last_login TIMESTAMP NULL,
        last_ip VARCHAR(64) NULL,
        failed_login_attempts INT DEFAULT 0,
        locked_until TIMESTAMP NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        min_deposit DECIMAL(18,8) NOT NULL,
        max_deposit DECIMAL(18,8) NOT NULL,
        daily_profit_percentage DECIMAL(5,2) NOT NULL,
        duration_days INT NOT NULL,
        status VARCHAR(10) DEFAULT 'active',
        projected_return_weekly DECIMAL(10,4) NULL,
        estimated_monthly DECIMAL(10,4) NULL,
        capital_withdrawal VARCHAR(100) NULL,
        support_level VARCHAR(100) NULL,
        audience_label VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Plans table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id INT NOT NULL REFERENCES plans(id),
        amount DECIMAL(18,8) NOT NULL,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Subscriptions table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(18,8) DEFAULT 0,
        btc_address VARCHAR(255),
        eth_address VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Wallets table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_wallets (
        id SERIAL PRIMARY KEY,
        btc_address VARCHAR(255) NOT NULL,
        eth_address VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Company Wallets table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        requested_ip VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        used_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Password reset requests table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INT REFERENCES subscriptions(id) ON DELETE SET NULL,
        type VARCHAR(20) NOT NULL,
        crypto_type VARCHAR(10) NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        tx_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Transactions table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS earnings (
        id SERIAL PRIMARY KEY,
        subscription_id INT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(18,8) NOT NULL,
        earned_date DATE NOT NULL,
        transferred_to_wallet BOOLEAN DEFAULT FALSE,
        transferred_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Earnings table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(18,8) NOT NULL,
        crypto_type VARCHAR(10) NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        deposit_reference VARCHAR(100) NOT NULL UNIQUE,
        transaction_id VARCHAR(255),
        proof_url VARCHAR(500),
        status VARCHAR(30) DEFAULT 'pending',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        proof_uploaded_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Deposits table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INT REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(18,8) NOT NULL,
        crypto_amount DECIMAL(18,8) NULL,
        crypto_type VARCHAR(10) NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        sent_tx_id VARCHAR(255),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Withdrawal Requests table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_type VARCHAR(30) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        allow_resubmit SMALLINT DEFAULT 0,
        admin_notes TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL
      )
    `);
    console.log('✅ KYC Documents table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        admin_response TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        replied_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Contact Messages table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (referrer_id, referred_user_id)
      )
    `);
    console.log('✅ Referrals table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id SERIAL PRIMARY KEY,
        referrer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(18,8) NOT NULL,
        commission_rate DECIMAL(5,2) DEFAULT 5.00,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        earned_at TIMESTAMP NULL,
        paid_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Referral Commissions table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS crypto_prices (
        id SERIAL PRIMARY KEY,
        crypto_symbol VARCHAR(10) NOT NULL,
        price_usd DECIMAL(18,8) NOT NULL,
        source VARCHAR(50) DEFAULT 'coingecko',
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (crypto_symbol, fetched_at)
      )
    `);
    console.log('✅ Crypto Prices table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value VARCHAR(255) NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ System Settings table created');

    await client.query(`
      INSERT INTO system_settings (setting_key, setting_value, description) VALUES
      ('MIN_DEPOSIT', '50', 'Minimum deposit amount in USD'),
      ('MAX_DEPOSIT', '5000', 'Maximum deposit amount in USD'),
      ('MIN_WITHDRAWAL', '1000', 'Minimum withdrawal amount in USD'),
      ('MAX_WITHDRAWAL', '50000', 'Maximum withdrawal amount in USD')
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
    `);
    console.log('✅ Default system settings inserted');

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        user_id INT NULL,
        actor_id INT NULL,
        entity_type VARCHAR(50) NULL,
        entity_id INT NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        metadata JSONB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Audit Logs table created');

    console.log('\n✅ All tables created successfully!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

createTables();
