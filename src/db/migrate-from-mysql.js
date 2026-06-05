/**
 * MySQL → PostgreSQL data migration script
 *
 * Copies all existing data from your MySQL database to the PostgreSQL database.
 * Safe to run against an empty PostgreSQL DB — skips rows that already exist.
 *
 * Prerequisites:
 *   npm install mysql2        (in this project, or run with: MYSQL_* env vars set)
 *
 * Usage:
 *   MYSQL_HOST=host MYSQL_PORT=3306 MYSQL_USER=user MYSQL_PASSWORD=pass MYSQL_DATABASE=dbname \
 *   node src/db/migrate-from-mysql.js
 *
 * Or add the MYSQL_* vars to your .env file before running.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Pool } = require('pg');

// ── Connection config ────────────────────────────────────────────────────────
const mysqlConfig = {
  host:     process.env.MYSQL_HOST     || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT || '3306'),
  user:     process.env.MYSQL_USER     || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'hyipro',
  ssl:      process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

const pg = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helpers ──────────────────────────────────────────────────────────────────
const toTs  = (v) => v ? new Date(v) : null;
const toBool = (v) => v === 1 || v === true || v === '1';
const toNum  = (v, def = 0) => v != null ? v : def;

let totalMigrated = 0;

async function migrateTable(label, mysqlConn, query, insert) {
  console.log(`\nMigrating ${label}...`);
  const [rows] = await mysqlConn.query(query);
  let count = 0;
  for (const row of rows) {
    try {
      await insert(row);
      count++;
    } catch (err) {
      if (err.code === '23505') {
        // unique_violation — already exists, skip
      } else {
        console.warn(`  ⚠  Skipped row (${err.message}):`, JSON.stringify(row).slice(0, 120));
      }
    }
  }
  totalMigrated += count;
  console.log(`  ✓ ${count} / ${rows.length} rows migrated`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('Connecting to MySQL...');
  const my = await mysql.createConnection(mysqlConfig);
  console.log('✓ MySQL connected');
  console.log('Connecting to PostgreSQL...');
  const pgClient = await pg.connect();
  console.log('✓ PostgreSQL connected\n');

  try {
    // ── users ──────────────────────────────────────────────────────────────
    await migrateTable('users', my,
      'SELECT * FROM users ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO users
           (id, email, password_hash, first_name, last_name, phone, country,
            kyc_verified, role, status, last_login, last_ip, user_agent,
            failed_login_attempts, locked_until, force_logout_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.email, r.password_hash,
          r.first_name, r.last_name, r.phone, r.country,
          toBool(r.kyc_verified),
          r.role || 'user',
          r.status || 'active',
          toTs(r.last_login), r.last_ip, r.user_agent,
          toNum(r.failed_login_attempts),
          toTs(r.locked_until), toTs(r.force_logout_at),
          toTs(r.created_at), toTs(r.updated_at),
        ]
      )
    );

    // Reset users sequence so new inserts don't collide
    await pgClient.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);

    // ── wallets ────────────────────────────────────────────────────────────
    await migrateTable('wallets', my,
      'SELECT * FROM wallets ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO wallets
           (id, user_id, btc_address, eth_address, balance, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.user_id,
          r.btc_address, r.eth_address,
          toNum(r.balance || r.usd_balance || r.btc_balance || 0),
          toTs(r.created_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('wallets_id_seq', COALESCE((SELECT MAX(id) FROM wallets), 1))`);

    // ── plans ──────────────────────────────────────────────────────────────
    await migrateTable('plans', my,
      'SELECT * FROM plans ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO plans
           (id, name, description, min_deposit, max_deposit, daily_profit_percentage,
            duration_days, status, projected_return_weekly, estimated_monthly,
            capital_withdrawal, support_level, audience_label, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.name, r.description,
          toNum(r.min_deposit), toNum(r.max_deposit),
          toNum(r.daily_profit_percentage),
          toNum(r.duration_days),
          r.status || 'active',
          toNum(r.projected_return_weekly), toNum(r.estimated_monthly),
          r.capital_withdrawal, r.support_level, r.audience_label,
          toTs(r.created_at), toTs(r.updated_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('plans_id_seq', COALESCE((SELECT MAX(id) FROM plans), 1))`);

    // ── subscriptions ──────────────────────────────────────────────────────
    await migrateTable('subscriptions', my,
      'SELECT * FROM subscriptions ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO subscriptions
           (id, user_id, plan_id, amount_invested, daily_profit_rate,
            status, start_date, end_date, total_earned, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.user_id, r.plan_id,
          toNum(r.amount_invested), toNum(r.daily_profit_rate),
          r.status || 'active',
          toTs(r.start_date), toTs(r.end_date),
          toNum(r.total_earned),
          toTs(r.created_at), toTs(r.updated_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('subscriptions_id_seq', COALESCE((SELECT MAX(id) FROM subscriptions), 1))`);

    // ── earnings ───────────────────────────────────────────────────────────
    await migrateTable('earnings', my,
      'SELECT * FROM earnings ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO earnings
           (id, user_id, subscription_id, amount, earned_date, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.user_id, r.subscription_id,
          toNum(r.amount),
          toTs(r.earned_date),
          toTs(r.created_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('earnings_id_seq', COALESCE((SELECT MAX(id) FROM earnings), 1))`);

    // ── deposits ───────────────────────────────────────────────────────────
    await migrateTable('deposits', my,
      'SELECT * FROM deposits ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO deposits
           (id, user_id, amount, currency, wallet_address, status,
            proof_image_path, confirmed_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.user_id,
          toNum(r.amount), r.currency,
          r.wallet_address, r.status || 'pending',
          r.proof_image_path,
          toTs(r.confirmed_at),
          toTs(r.created_at), toTs(r.updated_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('deposits_id_seq', COALESCE((SELECT MAX(id) FROM deposits), 1))`);

    // ── withdrawal_requests ────────────────────────────────────────────────
    await migrateTable('withdrawal_requests', my,
      'SELECT * FROM withdrawal_requests ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO withdrawal_requests
           (id, user_id, amount, currency, wallet_address, status,
            processed_at, rejection_reason, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.user_id,
          toNum(r.amount), r.currency,
          r.wallet_address, r.status || 'pending',
          toTs(r.processed_at), r.rejection_reason,
          toTs(r.created_at), toTs(r.updated_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('withdrawal_requests_id_seq', COALESCE((SELECT MAX(id) FROM withdrawal_requests), 1))`);

    // ── transactions ───────────────────────────────────────────────────────
    await migrateTable('transactions', my,
      'SELECT * FROM transactions ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO transactions
           (id, user_id, type, amount, currency, status, reference, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.user_id, r.type,
          toNum(r.amount), r.currency,
          r.status || 'completed', r.reference,
          toTs(r.created_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('transactions_id_seq', COALESCE((SELECT MAX(id) FROM transactions), 1))`);

    // ── kyc_documents ──────────────────────────────────────────────────────
    await migrateTable('kyc_documents', my,
      'SELECT * FROM kyc_documents ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO kyc_documents
           (id, user_id, document_type, file_path, status, reviewed_at, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.user_id,
          r.document_type, r.file_path,
          r.status || 'pending',
          toTs(r.reviewed_at), r.notes,
          toTs(r.created_at), toTs(r.updated_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('kyc_documents_id_seq', COALESCE((SELECT MAX(id) FROM kyc_documents), 1))`);

    // ── referrals ──────────────────────────────────────────────────────────
    await migrateTable('referrals', my,
      'SELECT * FROM referrals ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO referrals
           (id, referrer_id, referred_id, created_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.referrer_id, r.referred_id, toTs(r.created_at)]
      )
    );
    await pgClient.query(`SELECT setval('referrals_id_seq', COALESCE((SELECT MAX(id) FROM referrals), 1))`);

    // ── referral_commissions ───────────────────────────────────────────────
    await migrateTable('referral_commissions', my,
      'SELECT * FROM referral_commissions ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO referral_commissions
           (id, referrer_id, referred_user_id, commission_amount, created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.referrer_id, r.referred_user_id, toNum(r.commission_amount), toTs(r.created_at)]
      )
    );
    await pgClient.query(`SELECT setval('referral_commissions_id_seq', COALESCE((SELECT MAX(id) FROM referral_commissions), 1))`);

    // ── contact_messages ───────────────────────────────────────────────────
    await migrateTable('contact_messages', my,
      'SELECT * FROM contact_messages ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO contact_messages
           (id, name, email, subject, message, reply, replied_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.name, r.email, r.subject, r.message,
          r.reply, toTs(r.replied_at), toTs(r.created_at),
        ]
      )
    );
    await pgClient.query(`SELECT setval('contact_messages_id_seq', COALESCE((SELECT MAX(id) FROM contact_messages), 1))`);

    // ── system_settings ────────────────────────────────────────────────────
    await migrateTable('system_settings', my,
      'SELECT * FROM system_settings ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO system_settings (setting_key, setting_value, description, updated_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (setting_key) DO UPDATE
           SET setting_value = EXCLUDED.setting_value,
               description   = EXCLUDED.description,
               updated_at    = EXCLUDED.updated_at`,
        [r.setting_key, r.setting_value, r.description, toTs(r.updated_at)]
      )
    );

    // ── company_wallets ────────────────────────────────────────────────────
    await migrateTable('company_wallets', my,
      'SELECT * FROM company_wallets ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO company_wallets (id, btc_address, eth_address, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.btc_address, r.eth_address, toTs(r.created_at), toTs(r.updated_at)]
      )
    );
    await pgClient.query(`SELECT setval('company_wallets_id_seq', COALESCE((SELECT MAX(id) FROM company_wallets), 1))`);

    // ── email_templates ────────────────────────────────────────────────────
    await migrateTable('email_templates', my,
      'SELECT * FROM email_templates ORDER BY id',
      async (r) => pgClient.query(
        `INSERT INTO email_templates (id, name, subject, body, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.name, r.subject, r.body, toTs(r.created_at), toTs(r.updated_at)]
      )
    );
    await pgClient.query(`SELECT setval('email_templates_id_seq', COALESCE((SELECT MAX(id) FROM email_templates), 1))`);

    console.log(`\n✅ Migration complete — ${totalMigrated} total rows migrated\n`);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    pgClient.release();
    await pg.end();
    await my.end();
  }
}

migrate();
