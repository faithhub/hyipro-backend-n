const pool = require('../config/database');
const { createReferralCommission } = require('./referralController');

const getAllPlans = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [plans] = await connection.execute(
        `SELECT id, name, description, min_deposit, max_deposit, 
                daily_profit_percentage, duration_days, status,
                projected_return_weekly, estimated_monthly, capital_withdrawal, support_level, audience_label
         FROM plans 
         WHERE status IN ('active', 'paused') 
         ORDER BY daily_profit_percentage DESC`
      );

      res.json({ plans });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [plans] = await connection.execute(
        `SELECT id, name, description, min_deposit, max_deposit, 
                daily_profit_percentage, duration_days, status,
                projected_return_weekly, estimated_monthly, capital_withdrawal, support_level, audience_label
         FROM plans 
         WHERE id = ?`,
        [id]
      );

      if (plans.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      res.json({ plan: plans[0] });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const subscribeToPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, crypto_type } = req.body;

    if (!amount || !crypto_type) {
      return res.status(400).json({ error: 'Amount and crypto_type are required' });
    }

    const connection = await pool.getConnection();

    try {
      // Check plan exists and is active
      const [plans] = await connection.execute(
        'SELECT id, min_deposit, max_deposit, status FROM plans WHERE id = ?',
        [id]
      );

      if (plans.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const plan = plans[0];

      if (plan.status !== 'active') {
        return res.status(400).json({ error: 'Plan is not available for subscription' });
      }

      if (amount < plan.min_deposit || amount > plan.max_deposit) {
        return res.status(400).json({
          error: `Amount must be between ${plan.min_deposit} and ${plan.max_deposit}`
        });
      }

      // Check if user already has 5 active subscriptions
      const [[activeCount]] = await connection.execute(
        `SELECT COUNT(*) as count FROM subscriptions WHERE user_id = ? AND status = 'active'`,
        [req.user.id]
      );

      if (activeCount.count >= 5) {
        return res.status(400).json({
          error: 'You can only have a maximum of 5 active subscriptions at a time'
        });
      }

      // Create subscription with 'pending' status (will become 'active' only when payment is confirmed)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.duration_days);

      const [result] = await connection.execute(
        `INSERT INTO subscriptions (user_id, plan_id, amount, end_date, status) 
         VALUES (?, ?, ?, ?, 'pending')`,
        [req.user.id, id, amount, endDate]
      );

      const subscriptionId = result.insertId;

      // Create deposit transaction
      await connection.execute(
        `INSERT INTO transactions (user_id, subscription_id, type, crypto_type, amount, status) 
         VALUES (?, ?, 'deposit', ?, ?, 'pending')`,
        [req.user.id, subscriptionId, crypto_type, amount]
      );

      // Check if user was referred and create commission
      const [referrals] = await connection.execute(
        `SELECT referrer_id FROM referrals WHERE referred_user_id = ? AND status = 'active' LIMIT 1`,
        [req.user.id]
      );

      if (referrals.length > 0) {
        const referrer_id = referrals[0].referrer_id;
        // Create referral commission (5% of subscription amount)
        await createReferralCommission(referrer_id, req.user.id, subscriptionId, amount);
      }

      res.status(201).json({
        message: 'Subscription created successfully',
        subscription: {
          id: subscriptionId,
          plan_id: id,
          amount,
          end_date: endDate,
          status: 'active'
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPlans,
  getPlanById,
  subscribeToPlan
};
