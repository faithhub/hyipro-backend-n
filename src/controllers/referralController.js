const pool = require('../config/database');

const generateReferralCode = (userId) => {
  return `HYIPRO${userId}`;
};

// Track referral when new user signs up with referral code
const trackReferral = async (req, res, next) => {
  try {
    const { referral_code } = req.body;
    const referred_user_id = req.user.id;

    if (!referral_code) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    const connection = await pool.getConnection();

    try {
      // Find referrer by referral code
      const [referrers] = await connection.execute(
        `SELECT referrer_id FROM referrals WHERE referral_code = ? LIMIT 1`,
        [referral_code]
      );

      if (referrers.length === 0) {
        return res.status(404).json({ error: 'Invalid referral code' });
      }

      const referrer_id = referrers[0].referrer_id;

      // Check if referral already exists
      const [existing] = await connection.execute(
        `SELECT id FROM referrals WHERE referrer_id = ? AND referred_user_id = ?`,
        [referrer_id, referred_user_id]
      );

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Referral already tracked' });
      }

      // Create referral record
      const [result] = await connection.execute(
        `INSERT INTO referrals (referrer_id, referred_user_id, referral_code, status)
         VALUES (?, ?, ?, 'active')`,
        [referrer_id, referred_user_id, referral_code]
      );

      res.status(201).json({
        message: 'Referral tracked successfully',
        referral: {
          id: result.insertId,
          referrer_id,
          referred_user_id,
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

// Get referral stats for a user
const getReferralStats = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const connection = await pool.getConnection();

    try {
      // Get total referrals
      const [[referralCount]] = await connection.execute(
        `SELECT COUNT(*) as total FROM referrals WHERE referrer_id = ?`,
        [user_id]
      );

      // Get user's referral code
      const [[userData]] = await connection.execute(
        `SELECT referral_code FROM users WHERE id = ?`,
        [user_id]
      );

      // Get active referrals
      const [[activeCount]] = await connection.execute(
        `SELECT COUNT(*) as total FROM referrals WHERE referrer_id = ? AND status = 'active'`,
        [user_id]
      );

      // Get total commission earned
      const [[commissionStats]] = await connection.execute(
        `SELECT 
          COALESCE(SUM(CASE WHEN status = 'earned' THEN amount END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) as pending,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) as total_paid
         FROM referral_commissions 
         WHERE referrer_id = ?`,
        [user_id]
      );

      // Get referral list with details
      const [referrals] = await connection.execute(
        `SELECT 
          r.id,
          r.referred_user_id,
          u.email,
          u.first_name,
          u.last_name,
          r.status,
          r.created_at,
          COALESCE(SUM(rc.amount), 0) as commission_earned
         FROM referrals r
         JOIN users u ON r.referred_user_id = u.id
         LEFT JOIN referral_commissions rc ON r.referrer_id = rc.referrer_id AND r.referred_user_id = rc.referred_user_id
         WHERE r.referrer_id = ?
         GROUP BY r.id, r.referred_user_id, u.email, u.first_name, u.last_name, r.status, r.created_at
         ORDER BY r.created_at DESC`,
        [user_id]
      );

      res.json({
        stats: {
          total_referrals: referralCount.total,
          active_referrals: activeCount.total,
          total_commission_earned: parseFloat(commissionStats.total_earned),
          pending_commission: parseFloat(commissionStats.pending),
          total_paid: parseFloat(commissionStats.total_paid),
          referral_code: userData?.referral_code || null
        },
        referrals
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Get referral commission history
const getReferralCommissions = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const connection = await pool.getConnection();

    try {
      const [commissions] = await connection.execute(
        `SELECT 
          rc.id,
          rc.referred_user_id,
          u.email,
          u.first_name,
          u.last_name,
          rc.amount,
          rc.commission_rate,
          rc.status,
          rc.created_at,
          rc.earned_at,
          rc.paid_at,
          p.name as plan_name,
          s.amount as subscription_amount
         FROM referral_commissions rc
         JOIN users u ON rc.referred_user_id = u.id
         JOIN subscriptions s ON rc.subscription_id = s.id
         JOIN plans p ON s.plan_id = p.id
         WHERE rc.referrer_id = ?
         ORDER BY rc.created_at DESC`,
        [user_id]
      );

      res.json({ commissions });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

// Create referral commission when subscription is created
const createReferralCommission = async (referrer_id, referred_user_id, subscription_id, subscription_amount) => {
  try {
    const connection = await pool.getConnection();

    try {
      // Calculate 5% commission
      const commission_amount = (subscription_amount * 5) / 100;

      // Check if referral exists
      const [referrals] = await connection.execute(
        `SELECT id FROM referrals WHERE referrer_id = ? AND referred_user_id = ?`,
        [referrer_id, referred_user_id]
      );

      if (referrals.length === 0) {
        console.log(`No referral found for referrer ${referrer_id} and referred user ${referred_user_id}`);
        return null;
      }

      // Create commission record
      const [result] = await connection.execute(
        `INSERT INTO referral_commissions (referrer_id, referred_user_id, subscription_id, amount, commission_rate, status, earned_at)
         VALUES (?, ?, ?, ?, 5.00, 'earned', NOW())`,
        [referrer_id, referred_user_id, subscription_id, commission_amount]
      );

      console.log(`✅ Referral commission created: ${commission_amount} for referrer ${referrer_id}`);
      return result.insertId;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating referral commission:', error);
    return null;
  }
};

module.exports = {
  generateReferralCode,
  trackReferral,
  getReferralStats,
  getReferralCommissions,
  createReferralCommission
};
