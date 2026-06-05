const cron = require('node-cron');
const pool = require('../config/database');
const { cleanupExpiredBlacklist } = require('../utils/tokenBlacklist');

const calculateDailyEarnings = async () => {
  console.log('🔄 Starting daily earnings calculation...');

  const connection = await pool.getConnection();

  try {
    // Get all active subscriptions
    const [subscriptions] = await connection.execute(
      `SELECT s.id, s.amount, p.daily_profit_percentage, s.end_date, s.user_id
       FROM subscriptions s 
       JOIN plans p ON s.plan_id = p.id 
       WHERE s.status = 'active' AND s.end_date > NOW()`
    );

    let earningsCount = 0;

    for (const subscription of subscriptions) {
      const dailyEarnings = (subscription.amount * subscription.daily_profit_percentage) / 100;

      await connection.execute(
        `INSERT INTO earnings (subscription_id, amount, earned_date) 
         VALUES (?, ?, CURRENT_DATE)`,
        [subscription.id, dailyEarnings]
      );

      earningsCount++;
    }

    console.log(`✅ Daily earnings calculated for ${earningsCount} subscriptions`);

    // Handle completed subscriptions - transfer principal and unwithdrawn earnings to wallet
    const [completedSubscriptions] = await connection.execute(
      `SELECT s.id, s.amount, s.user_id 
       FROM subscriptions s 
       WHERE s.status = 'active' AND s.end_date <= NOW()`
    );

    let completedCount = 0;
    for (const subscription of completedSubscriptions) {
      try {
        // Get unwithdrawn earnings
        const [unwithdrawnEarnings] = await connection.execute(
          `SELECT COALESCE(SUM(amount), 0) as total 
           FROM earnings 
           WHERE subscription_id = ? AND transferred_to_wallet = false`,
          [subscription.id]
        );

        const totalUnwithdrawn = parseFloat(unwithdrawnEarnings[0].total);
        const principal = parseFloat(subscription.amount);
        const totalTransfer = principal + totalUnwithdrawn;

        if (totalTransfer > 0) {
          // Add to user's wallet
          await connection.execute(
            `UPDATE wallets SET balance = balance + ? WHERE user_id = ?`,
            [totalTransfer, subscription.user_id]
          );

          // Mark earnings as transferred
          await connection.execute(
            `UPDATE earnings SET transferred_to_wallet = true, transferred_at = NOW() 
             WHERE subscription_id = ? AND transferred_to_wallet = false`,
            [subscription.id]
          );

          console.log(`💰 Transferred $${totalTransfer.toFixed(2)} to wallet for user ${subscription.user_id} (principal: $${principal.toFixed(2)}, earnings: $${totalUnwithdrawn.toFixed(2)})`);
        }

        // Mark subscription as completed
        await connection.execute(
          `UPDATE subscriptions SET status = 'completed' WHERE id = ?`,
          [subscription.id]
        );

        completedCount++;
      } catch (error) {
        console.error(`❌ Error processing completed subscription ${subscription.id}:`, error.message);
      }
    }

    console.log(`✅ Completed ${completedCount} subscriptions and transferred funds to wallets`);
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
