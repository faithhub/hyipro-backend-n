require('dotenv').config();
const mysql = require('mysql2/promise');

const createTables = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hyipro_db'
  });

  try {
    console.log('🔄 Creating database tables...');

    // Users Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        country VARCHAR(100),
        kyc_verified BOOLEAN DEFAULT FALSE,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role)
      )
    `);
    console.log('✅ Users table created');

    // Plans Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS plans (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        min_deposit DECIMAL(18,8) NOT NULL,
        max_deposit DECIMAL(18,8) NOT NULL,
        daily_profit_percentage DECIMAL(5,2) NOT NULL,
        duration_days INT NOT NULL,
        status ENUM('active', 'paused', 'stopped') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Plans table created');

    // Ensure extra columns for richer plan metadata
    try { await connection.execute(`ALTER TABLE plans ADD COLUMN projected_return_weekly DECIMAL(10,4) NULL`); } catch (e) {}
    try { await connection.execute(`ALTER TABLE plans ADD COLUMN estimated_monthly DECIMAL(10,4) NULL`); } catch (e) {}
    try { await connection.execute(`ALTER TABLE plans ADD COLUMN capital_withdrawal VARCHAR(100) NULL`); } catch (e) {}
    try { await connection.execute(`ALTER TABLE plans ADD COLUMN support_level VARCHAR(100) NULL`); } catch (e) {}
    try { await connection.execute(`ALTER TABLE plans ADD COLUMN audience_label VARCHAR(255) NULL`); } catch (e) {}
    console.log('✅ Plans extra columns ensured');

    // Subscriptions Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NULL DEFAULT NULL,
        status ENUM('active', 'completed', 'withdrawn') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES plans(id),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Subscriptions table created');

    // Wallets Table (User Wallets)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        balance DECIMAL(18, 8) DEFAULT 0,
        btc_address VARCHAR(255),
        eth_address VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Wallets table created');

    // Ensure wallets table has balance column
    try {
      await connection.execute(`
        ALTER TABLE wallets
        ADD COLUMN balance DECIMAL(18, 8) DEFAULT 0;
      `);
      console.log('✅ Wallets.balance column added');
    } catch (e) {
      console.log('ℹ️ Wallets.balance column may already exist');
    }

    // Company Wallets Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS company_wallets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        btc_address VARCHAR(255) NOT NULL,
        eth_address VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Company Wallets table created');

    // Password Reset Requests Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        status ENUM('pending', 'completed', 'expired', 'failed') DEFAULT 'pending',
        requested_ip VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        used_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Password reset requests table created');

    // Transactions Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        subscription_id INT,
        type ENUM('deposit', 'withdrawal', 'earnings') NOT NULL,
        crypto_type ENUM('BTC', 'ETH') NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
        tx_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_tx_hash (tx_hash)
      )
    `);
    console.log('✅ Transactions table created');

    // Earnings Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS earnings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        subscription_id INT NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        earned_date DATE NOT NULL,
        transferred_to_wallet BOOLEAN DEFAULT FALSE,
        transferred_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
        INDEX idx_subscription_id (subscription_id),
        INDEX idx_earned_date (earned_date),
        INDEX idx_transferred (transferred_to_wallet)
      )
    `);
    console.log('✅ Earnings table created');

    // Ensure earnings table has transferred columns
    try {
      await connection.execute(`
        ALTER TABLE earnings
        ADD COLUMN transferred_to_wallet BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ Earnings.transferred_to_wallet column added');
    } catch (e) {
      console.log('ℹ️ Earnings.transferred_to_wallet column may already exist');
    }
    try {
      await connection.execute(`
        ALTER TABLE earnings
        ADD COLUMN transferred_at TIMESTAMP NULL;
      `);
      console.log('✅ Earnings.transferred_at column added');
    } catch (e) {
      console.log('ℹ️ Earnings.transferred_at column may already exist');
    }

    // Deposits Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS deposits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        subscription_id INT NULL,
        amount DECIMAL(18,8) NOT NULL,
        crypto_type ENUM('BTC', 'ETH') NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        deposit_reference VARCHAR(100) NOT NULL UNIQUE,
        transaction_id VARCHAR(255),
        proof_url VARCHAR(500),
        status ENUM('pending', 'awaiting_approval', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_subscription_id (subscription_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Deposits table created');

    // Ensure deposits table has nullable subscription_id and deposit_reference column
    try {
      await connection.execute(`
        ALTER TABLE deposits
        MODIFY subscription_id INT NULL;
      `);
      console.log('✅ Deposits.subscription_id set to NULLable');
    } catch (e) {
      console.log('ℹ️ Deposits.subscription_id already NULLable');
    }

    try {
      await connection.execute(`
        ALTER TABLE deposits
        ADD COLUMN deposit_reference VARCHAR(100) NULL AFTER wallet_address;
      `);
      console.log('✅ Deposits.deposit_reference column added as NULLable');
    } catch (e) {
      console.log('ℹ️ Deposits.deposit_reference column may already exist');
    }

    // Backfill any null/empty deposit_reference values then enforce NOT NULL + UNIQUE
    try {
      await connection.execute(`
        UPDATE deposits
        SET deposit_reference = CONCAT('DEP-', id)
        WHERE deposit_reference IS NULL OR deposit_reference = '';
      `);
      await connection.execute(`
        ALTER TABLE deposits
        MODIFY deposit_reference VARCHAR(100) NOT NULL,
        ADD UNIQUE INDEX idx_deposit_reference (deposit_reference);
      `);
      console.log('✅ Deposits.deposit_reference backfilled and constrained');
    } catch (e) {
      console.log('ℹ️ Deposits.deposit_reference backfill/constraint may already be applied');
    }

    // Ensure deposits table has proof_uploaded_at and rejected_at columns
    try {
      await connection.execute(`
        ALTER TABLE deposits
        ADD COLUMN proof_uploaded_at TIMESTAMP NULL AFTER approved_at;
      `);
      console.log('✅ Deposits.proof_uploaded_at column added');
    } catch (e) {
      console.log('ℹ️ Deposits.proof_uploaded_at column may already exist');
    }

    try {
      await connection.execute(`
        ALTER TABLE deposits
        ADD COLUMN rejected_at TIMESTAMP NULL AFTER proof_uploaded_at;
      `);
      console.log('✅ Deposits.rejected_at column added');
    } catch (e) {
      console.log('ℹ️ Deposits.rejected_at column may already exist');
    }

    // Withdrawal Requests Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        subscription_id INT,
        amount DECIMAL(18,8) NOT NULL,
        crypto_amount DECIMAL(18,8) NULL,
        crypto_type ENUM('BTC', 'ETH') NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
        sent_tx_id VARCHAR(255),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Withdrawal Requests table created');

    // Ensure withdrawal_requests table has crypto_amount column
    try {
      await connection.execute(`
        ALTER TABLE withdrawal_requests
        ADD COLUMN crypto_amount DECIMAL(18,8) NULL AFTER amount;
      `);
      console.log('✅ Withdrawal_requests.crypto_amount column added');
    } catch (e) {
      console.log('ℹ️ Withdrawal_requests.crypto_amount column may already exist');
    }

    // Add status column to users if not exists
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS status ENUM('active', 'suspended') DEFAULT 'active'
      `);
      console.log('✅ Users status column added');
    } catch (e) {
      // MySQL doesn't support IF NOT EXISTS for ALTER TABLE, try/catch handles it
      console.log('ℹ️ Users status column may already exist');
    }

    // Add last_login column to users if not exists
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL
      `);
      console.log('✅ Users last_login column added');
    } catch (e) {
      console.log('ℹ️ Users last_login column may already exist');
    }

    // Add last_ip and user_agent columns to users if not exists
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_ip VARCHAR(64) NULL
      `);
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255) NULL
      `);
      console.log('✅ Users last_ip and user_agent columns added');
    } catch (e) {
      console.log('ℹ️ Users last_ip/user_agent columns may already exist');
    }

    // KYC Documents Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kyc_documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        document_type ENUM('id_card', 'passport', 'drivers_license', 'selfie') NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        allow_resubmit TINYINT(1) DEFAULT 0,
        admin_notes TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ KYC Documents table created');

    //sjdkjbjsd
    // Ensure allow_resubmit column exists for existing installations
    // await connection.execute(`
    //   ALTER TABLE kyc_documents 
    //   ADD COLUMN IF NOT EXISTS allow_resubmit TINYINT(1) DEFAULT 0
    // `);
    // console.log('✅ kyc_documents.allow_resubmit ensured');

    // Contact Messages Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('new', 'replied') DEFAULT 'new',
        admin_response TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        replied_at TIMESTAMP NULL,
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ Contact Messages table created');

    // Referrals Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referrer_id INT NOT NULL,
        referred_user_id INT NOT NULL,
        referral_code VARCHAR(50) UNIQUE NOT NULL,
        status ENUM('pending', 'active', 'inactive') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_referrer_id (referrer_id),
        INDEX idx_referred_user_id (referred_user_id),
        INDEX idx_referral_code (referral_code),
        UNIQUE KEY unique_referral (referrer_id, referred_user_id)
      )
    `);
    console.log('✅ Referrals table created');

    // Referral Commissions Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referrer_id INT NOT NULL,
        referred_user_id INT NOT NULL,
        subscription_id INT NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        commission_rate DECIMAL(5,2) DEFAULT 5.00,
        status ENUM('pending', 'earned', 'paid') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        earned_at TIMESTAMP NULL,
        paid_at TIMESTAMP NULL,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
        INDEX idx_referrer_id (referrer_id),
        INDEX idx_referred_user_id (referred_user_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Referral Commissions table created');

    // Crypto Prices Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crypto_prices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        crypto_symbol VARCHAR(10) NOT NULL,
        price_usd DECIMAL(18,8) NOT NULL,
        source VARCHAR(50) DEFAULT 'coingecko',
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_crypto_symbol (crypto_symbol),
        INDEX idx_fetched_at (fetched_at),
        UNIQUE KEY unique_crypto_price (crypto_symbol, fetched_at)
      )
    `);
    console.log('✅ Crypto Prices table created');

    // System Settings Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value VARCHAR(255) NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ System Settings table created');

    // Insert default system settings
    try {
      await connection.execute(`
        INSERT INTO system_settings (setting_key, setting_value, description) VALUES
        ('MIN_DEPOSIT', '50', 'Minimum deposit amount in USD'),
        ('MAX_DEPOSIT', '5000', 'Maximum deposit amount in USD'),
        ('MIN_WITHDRAWAL', '1000', 'Minimum withdrawal amount in USD'),
        ('MAX_WITHDRAWAL', '50000', 'Maximum withdrawal amount in USD')
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `);
      console.log('✅ Default system settings inserted');
    } catch (e) {
      console.log('ℹ️ System settings may already exist');
    }

    console.log('\n✅ All tables created successfully!');
    await connection.end();
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
};

createTables();
