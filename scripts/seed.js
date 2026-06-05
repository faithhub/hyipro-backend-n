require('dotenv').config();
const pool = require('../src/config/database');

const seedPlans = async () => {
  try {
    const connection = await pool.getConnection();

    const seedPlans = [
      {
        name: 'Starter Plan',
        description: 'For beginners. Good for first-time investors testing the platform.',
        min: 50,
        max: 99,
        weekly: 3,
        monthly: 12,
        duration: 30,
        cap: 'End of cycle',
        support: 'Standard',
        audience: 'For beginners'
      },
      {
        name: 'Growth Plan',
        description: 'For steady investors. Balanced risk-to-return plan.',
        min: 100,
        max: 299,
        weekly: 4,
        monthly: 16,
        duration: 30,
        cap: 'End of cycle',
        support: 'Priority',
        audience: 'For steady investors'
      },
      {
        name: 'Advanced Plan',
        description: 'For experienced investors. Strong middle/high tier.',
        min: 300,
        max: 499,
        weekly: 4.5,
        monthly: 18,
        duration: 30,
        cap: 'Flexible after maturity',
        support: 'Dedicated assistance',
        audience: 'For experienced investors'
      },
      {
        name: 'Premium Elite Plan',
        description: 'For high-capital investors. Designed for larger portfolio holders.',
        min: 500,
        max: 5000,
        weekly: 5,
        monthly: 20,
        duration: 30,
        cap: 'Flexible',
        support: 'VIP / 24/7 support',
        audience: 'For high-capital investors'
      },
    ];

    for (const plan of seedPlans) {
      const [existing] = await connection.execute('SELECT id FROM plans WHERE name = ? LIMIT 1', [plan.name]);
      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO plans (name, description, min_deposit, max_deposit, daily_profit_percentage, duration_days, status, projected_return_weekly, estimated_monthly, capital_withdrawal, support_level, audience_label)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
          [
            plan.name,
            plan.description,
            plan.min,
            plan.max,
            (plan.weekly / 7).toFixed(4),
            plan.duration,
            plan.weekly,
            plan.monthly,
            plan.cap,
            plan.support,
            plan.audience
          ]
        );
        console.log(`✅ Inserted plan: ${plan.name}`);
      } else {
        console.log(`ℹ️  Plan already exists: ${plan.name}`);
      }
    }

    console.log('\n✅ Seed data completed successfully!');
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedPlans();
