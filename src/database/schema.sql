-- Company Wallets Table
CREATE TABLE IF NOT EXISTS company_wallets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  btc_address VARCHAR(100) NOT NULL UNIQUE,
  eth_address VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Deposits Table
CREATE TABLE IF NOT EXISTS deposits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  subscription_id INT NULL,
  crypto_type VARCHAR(10) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  deposit_reference VARCHAR(50) NOT NULL UNIQUE,
  wallet_address VARCHAR(100) NOT NULL,
  transaction_id VARCHAR(100),
  proof_url VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255),
  proof_uploaded_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  rejected_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_deposit_reference (deposit_reference)
);

-- Withdrawal Requests Table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  subscription_id INT NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  crypto_type VARCHAR(10) NOT NULL,
  wallet_address VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  sent_tx_id VARCHAR(100),
  rejection_reason VARCHAR(255),
  approved_by INT,
  approved_at TIMESTAMP NULL,
  rejected_at TIMESTAMP NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);
