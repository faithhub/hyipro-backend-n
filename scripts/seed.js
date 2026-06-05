require('dotenv').config();
const pool = require('../src/config/database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('🌱 Starting database seed...\n');

    // ─── USERS ───────────────────────────────────────────────
    const adminPassword = await bcrypt.hash('Admin@12345', 10);
    const userPassword = await bcrypt.hash('User@12345', 10);

    const users = [
      {
        email: 'admin@hyipro.com',
        password_hash: "Admin@12345",
        first_name: 'Super',
        last_name: 'Admin',
        country: 'Nigeria',
        kyc_verified: true,
        role: 'admin',
        status: 'active'
      }
    ];

    for (const user of users) {
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE email = $1 LIMIT 1', [user.email]
      );
      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO users (email, password_hash, first_name, last_name, country, kyc_verified, role, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [user.email, user.password_hash, user.first_name, user.last_name,
           user.country, user.kyc_verified, user.role, user.status]
        );
        console.log(`✅ Inserted user: ${user.email}`);
      } else {
        console.log(`ℹ️  User already exists: ${user.email}`);
      }
    }

    // ─── PLANS ───────────────────────────────────────────────
    const plans = [
      {
        name: 'Starter Plan',
        description: 'For beginners. Good for first-time investors testing the platform.',
        min: 50, max: 99, weekly: 3, monthly: 12, duration: 30,
        status: 'stopped', cap: 'End of cycle',
        support: 'Standard', audience: 'For beginners'
      },
      {
        name: 'Growth Plan',
        description: 'For steady investors. Balanced risk-to-return plan.',
        min: 100, max: 299, weekly: 4, monthly: 16, duration: 30,
        status: 'active', cap: 'End of cycle',
        support: 'Priority', audience: 'For steady investors'
      },
      {
        name: 'Advanced Plan',
        description: 'For experienced investors. Strong middle/high tier.',
        min: 300, max: 499, weekly: 4.5, monthly: 18, duration: 30,
        status: 'active', cap: 'Flexible after maturity',
        support: 'Dedicated assistance', audience: 'For experienced investors'
      },
      {
        name: 'Premium Elite Plan',
        description: 'For high-capital investors. Designed for larger portfolio holders.',
        min: 500, max: 5000, weekly: 5, monthly: 20, duration: 30,
        status: 'active', cap: 'Flexible',
        support: 'VIP / 24/7 support', audience: 'For high-capital investors'
      },
    ];

    for (const plan of plans) {
      const [existing] = await connection.execute(
        'SELECT id FROM plans WHERE name = $1 LIMIT 1', [plan.name]
      );
      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO plans (name, description, min_deposit, max_deposit, daily_profit_percentage,
           duration_days, status, projected_return_weekly, estimated_monthly,
           capital_withdrawal, support_level, audience_label)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            plan.name, plan.description, plan.min, plan.max,
            (plan.weekly / 7).toFixed(4), plan.duration, plan.status,
            plan.weekly, plan.monthly, plan.cap, plan.support, plan.audience
          ]
        );
        console.log(`✅ Inserted plan: ${plan.name}`);
      } else {
        console.log(`ℹ️  Plan already exists: ${plan.name}`);
      }
    }

    // ─── COMPANY WALLETS ─────────────────────────────────────
    const [existingWallet] = await connection.execute(
      'SELECT id FROM company_wallets LIMIT 1'
    );
    if (existingWallet.length === 0) {
      await connection.execute(
        `INSERT INTO company_wallets (btc_address, eth_address) VALUES ($1, $2)`,
        [
          'bc1qhzzd07ea597juwncnewx8hlm0ce03jxuwf5s34',
          '0xfa248297CcC19153824Fb1578381946b2A8c55ED'
        ]
      );
      console.log('✅ Inserted company wallets');
    } else {
      console.log('ℹ️  Company wallets already exist');
    }

    // ─── SYSTEM SETTINGS ─────────────────────────────────────
    const settings = [
      { key: 'MIN_DEPOSIT',    value: '50',    desc: 'Minimum deposit amount in USD' },
      { key: 'MAX_DEPOSIT',    value: '5000',  desc: 'Maximum deposit amount in USD' },
      { key: 'MIN_WITHDRAWAL', value: '50',    desc: 'Minimum withdrawal amount in USD' },
      { key: 'MAX_WITHDRAWAL', value: '50000', desc: 'Maximum withdrawal amount in USD' },
    ];

    for (const s of settings) {
      await connection.execute(
        `INSERT INTO system_settings (setting_key, setting_value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [s.key, s.value, s.desc]
      );
    }
    console.log('✅ System settings seeded');

    console.log('\n✅ All seed data inserted successfully!');
    console.log('\n📋 Admin Login:');
    console.log('   Email:    admin@hyipro.com');
    console.log('   Password: Admin@12345');
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedDatabase();
