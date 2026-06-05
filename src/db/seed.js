/**
 * Seed script — safe to run multiple times (uses INSERT ... ON CONFLICT DO NOTHING / DO UPDATE)
 * Usage: node src/db/seed.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. SYSTEM SETTINGS ─────────────────────────────────────────────────
    console.log('Seeding system_settings...');
    const settings = [
      ['MIN_DEPOSIT',          '50',                            'Minimum deposit amount in USD'],
      ['MAX_DEPOSIT',          '5000',                          'Maximum deposit amount in USD'],
      ['MIN_WITHDRAWAL',       '50',                            'Minimum withdrawal amount in USD'],
      ['MAX_WITHDRAWAL',       '50000',                         'Maximum withdrawal amount in USD'],
      ['site_name',            'HYIPro',                        'Platform display name'],
      ['site_url',             'https://hyipro.com',            'Frontend URL'],
      ['support_email',        'support@hyipro.com',            'Support contact email'],
      ['withdrawal_fee',       '1',                             'Withdrawal fee percentage (e.g. 1 = 1%)'],
      ['referral_bonus',       '5',                             'Referral commission percentage on investment'],
      ['kyc_required',         'true',                          'Whether KYC must be approved before withdrawals'],
      ['maintenance_mode',     'false',                         'Set to true to put platform in maintenance mode'],
      ['earnings_cron',        '0 0 * * *',                     'Cron schedule for daily earnings job'],
      ['deposit_confirmations','1',                             'Number of blockchain confirmations required'],
      ['max_active_plans',     '3',                             'Max concurrent active subscriptions per user'],
    ];

    for (const [key, value, description] of settings) {
      await client.query(
        `INSERT INTO system_settings (setting_key, setting_value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) DO UPDATE
           SET setting_value = EXCLUDED.setting_value,
               description   = EXCLUDED.description,
               updated_at    = NOW()`,
        [key, value, description]
      );
    }
    console.log(`  ✓ ${settings.length} settings upserted`);

    // ─── 2. COMPANY WALLETS ─────────────────────────────────────────────────
    console.log('Seeding company_wallets...');
    const walletCount = await client.query('SELECT COUNT(*) FROM company_wallets');
    if (Number(walletCount.rows[0].count) === 0) {
      await client.query(
        `INSERT INTO company_wallets (btc_address, eth_address)
         VALUES ($1, $2)`,
        [
          'bc1qhzzd07ea597juwncnewx8hlm0ce03jxuwf5s34',
          '0xfa248297CcC19153824Fb1578381946b2A8c55ED',
        ]
      );
      console.log('  ✓ Company wallet record created');
    } else {
      console.log('  – Company wallet already exists, skipping');
    }

    // ─── 3. INVESTMENT PLANS ─────────────────────────────────────────────────
    console.log('Seeding plans...');
    const plans = [
      {
        name: 'Starter Plan',
        description: 'Here we go',
        min_deposit: 50.00,
        max_deposit: 99.00,
        daily_profit_percentage: 3.00,
        duration_days: 30,
        projected_return_weekly: null,
        estimated_monthly: null,
        capital_withdrawal: null,
        support_level: null,
        audience_label: null,
        status: 'stopped',
      },
      {
        name: 'Growth Plan',
        description: 'For steady investors. Balanced risk-to-return plan.',
        min_deposit: 100.00,
        max_deposit: 299.00,
        daily_profit_percentage: 0.57,
        duration_days: 30,
        projected_return_weekly: 5.00,
        estimated_monthly: 20.00,
        capital_withdrawal: 'End of cycle',
        support_level: 'Priority',
        audience_label: null,
        status: 'active',
      },
      {
        name: 'Advanced Plan',
        description: 'For experienced investors. Strong middle/high tier.',
        min_deposit: 300.00,
        max_deposit: 499.00,
        daily_profit_percentage: 0.64,
        duration_days: 30,
        projected_return_weekly: 4.50,
        estimated_monthly: 18.00,
        capital_withdrawal: 'Flexible after maturity',
        support_level: 'Dedicated assistance',
        audience_label: 'For experienced investors',
        status: 'active',
      },
      {
        name: 'Premium Elite Plan',
        description: 'For high-capital investors. Designed for larger portfolio holders.',
        min_deposit: 500.00,
        max_deposit: 5000.00,
        daily_profit_percentage: 0.71,
        duration_days: 30,
        projected_return_weekly: 5.00,
        estimated_monthly: 20.00,
        capital_withdrawal: 'Flexible',
        support_level: 'VIP / 24/7 support',
        audience_label: 'For high-capital investors',
        status: 'active',
      },
    ];

    let plansInserted = 0;
    for (const p of plans) {
      const exists = await client.query('SELECT id FROM plans WHERE name = $1', [p.name]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO plans
             (name, description, min_deposit, max_deposit, daily_profit_percentage,
              duration_days, projected_return_weekly, estimated_monthly,
              capital_withdrawal, support_level, audience_label, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            p.name, p.description, p.min_deposit, p.max_deposit,
            p.daily_profit_percentage, p.duration_days, p.projected_return_weekly,
            p.estimated_monthly, p.capital_withdrawal, p.support_level,
            p.audience_label, p.status,
          ]
        );
        plansInserted++;
      }
    }
    console.log(`  ✓ ${plansInserted} new plans inserted (${plans.length - plansInserted} already existed)`);

    // ─── 4. ADMIN USER ───────────────────────────────────────────────────────
    console.log('Seeding admin user...');
    const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@hyipro.com';
    const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456!';
    const ADMIN_FIRST    = process.env.SEED_ADMIN_FIRST    || 'Platform';
    const ADMIN_LAST     = process.env.SEED_ADMIN_LAST     || 'Admin';

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, status, kyc_verified)
         VALUES ($1, $2, $3, $4, 'admin', 'active', true)`,
        [ADMIN_EMAIL, hash, ADMIN_FIRST, ADMIN_LAST]
      );

      // Create a wallet record for the admin too
      const adminRow = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
      const adminId = adminRow.rows[0].id;
      await client.query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [adminId]
      );

      console.log(`  ✓ Admin user created: ${ADMIN_EMAIL}`);
      console.log(`  ⚠  Default password: ${ADMIN_PASSWORD}  — CHANGE THIS IMMEDIATELY after first login`);
    } else {
      console.log(`  – Admin user already exists (${ADMIN_EMAIL}), skipping`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
