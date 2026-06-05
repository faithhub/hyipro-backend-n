const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const referralController = require('../controllers/referralController');

// Track referral when user signs up
router.post('/track', authMiddleware, referralController.trackReferral);

// Get referral stats for current user
router.get('/stats', authMiddleware, referralController.getReferralStats);

// Get referral commission history
router.get('/commissions', authMiddleware, referralController.getReferralCommissions);

module.exports = router;
