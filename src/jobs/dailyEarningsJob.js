const cron = require('node-cron');
const pool = require('../config/database');
const { cleanupExpiredBlacklist } = require('../utils/tokenBlacklist');

const calculateDailyEarnings = async () => {
  console.log('🔄 Starting daily earnings calculation...');

  const connection = await pool.getConnection();

  try {
    // Get all active subscriptions
    const [subscriptions] = await connection.execute(
      `SELECT s.id, s.amount, p.daily_profit_percentage, s.end_date 
       FROM subscriptions s 
       JOIN plans p ON s.plan_id = p.id 
       WHERE s.status = 'active' AND s.end_date > NOW()`
    );

    let earningsCount = 0;

    for (const subscription of subscriptions) {
      const dailyEarnings = (subscription.amount * subscription.daily_profit_percentage) / 100;

      await connection.execute(
        `INSERT INTO earnings (subscription_id, amount, earned_date) 
         VALUES (?, ?, CURDATE())`,
        [subscription.id, dailyEarnings]
      );

      earningsCount++;
    }

    // Mark completed subscriptions
    await connection.execute(
      `UPDATE subscriptions 
       SET status = 'completed' 
       WHERE status = 'active' AND end_date <= NOW()`
    );

    console.log(`✅ Daily earnings calculated for ${earningsCount} subscriptions`);
  } catch (error) {
    console.error('❌ Error calculating daily earnings:', error);
  } finally {
    connection.release();
  }
};

// Schedule job to run every day at midnight UTC
const startDailyEarningsJob = () => {
  cron.schedule('0 0 * * *', calculateDailyEarnings);
  // Clean up expired blacklist entries every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await cleanupExpiredBlacklist();
    } catch (err) {
      console.error('❌ Error cleaning up token blacklist:', err.message);
    }
  });
  console.log('📅 Daily earnings job scheduled (runs at 00:00 UTC)');
};

module.exports = { startDailyEarningsJob, calculateDailyEarnings };
