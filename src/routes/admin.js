const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { getAuditLogs, getAuditActions, getUserAuditLogs } = require('../controllers/auditController');

// Plan management
router.get('/plans', adminMiddleware, adminController.getAllPlans);
router.post('/plans', adminMiddleware, adminController.createPlan);
router.put('/plans/:id', adminMiddleware, adminController.updatePlan);
router.patch('/plans/:id/status', adminMiddleware, adminController.updatePlanStatus);

// User management
router.get('/users', adminMiddleware, adminController.getAllUsers);
router.get('/users/:id', adminMiddleware, adminController.getUserDetails);
router.get('/users/:id/subscriptions', adminMiddleware, adminController.getUserSubscriptions);
router.get('/users/:id/transactions', adminMiddleware, adminController.getUserTransactions);
router.get('/users/:id/earnings', adminMiddleware, adminController.getUserEarnings);
router.get('/users/:id/withdrawals', adminMiddleware, adminController.getUserWithdrawals);
router.get('/users/:id/kyc-documents', adminMiddleware, adminController.getUserKycDocuments);
router.get('/users/:id/password-reset-requests', adminMiddleware, adminController.getUserPasswordResetRequests);
router.put('/users/:id', adminMiddleware, adminController.updateUser);
router.patch('/users/:id/password', adminMiddleware, adminController.updateUserPassword);
router.delete('/users/:id', adminMiddleware, adminController.deleteUser);
router.patch('/users/:id/role', adminMiddleware, adminController.updateUserRole);
router.patch('/users/:id/status', adminMiddleware, adminController.updateUserStatus);
router.patch('/users/:id/kyc', adminMiddleware, adminController.updateUserKyc);
router.patch('/users/:id/kyc/resubmit', adminMiddleware, adminController.allowKycResubmit);
router.post('/users/:id/force-logout', adminMiddleware, adminController.forceLogoutUser);

// Password reset request management
router.get('/password-reset-requests', adminMiddleware, adminController.getPasswordResetRequests);

// Withdrawal management
router.get('/withdrawals', adminMiddleware, adminController.getAllWithdrawals);
router.patch('/withdrawals/:id/approve', adminMiddleware, adminController.approveWithdrawal);
router.patch('/withdrawals/:id/reject', adminMiddleware, adminController.rejectWithdrawal);

// Deposit management
router.get('/deposits', adminMiddleware, adminController.getAllDeposits);
router.patch('/deposits/:id/approve', adminMiddleware, adminController.approveDeposit);

// Wallet management
router.get('/wallets', adminMiddleware, adminController.getAllWallets);
router.get('/wallets/:id/transactions', adminMiddleware, adminController.getWalletTransactions);
router.patch('/wallets/:id/balance', adminMiddleware, adminController.updateWalletBalance);
router.patch('/wallets/:id', adminMiddleware, adminController.adminUpdateWallet);

// Contact messages
router.get('/contacts', adminMiddleware, adminController.getAllContacts);
router.patch('/contacts/:id/reply', adminMiddleware, adminController.replyContactMessage);

// Dashboard stats
router.get('/stats', adminMiddleware, adminController.getDashboardStats);

// Financial statistics (withdrawals + deposits breakdown)
router.get('/stats/financial', adminMiddleware, adminController.getFinancialStats);

// User statistics (registrations, KYC, roles, countries)
router.get('/stats/users', adminMiddleware, adminController.getUserStats);

// Investment statistics (subscriptions by plan/status + earnings)
router.get('/stats/investments', adminMiddleware, adminController.getInvestmentStats);

// Referral statistics (referrers, commissions, daily trend)
router.get('/stats/referrals', adminMiddleware, adminController.getReferralStats);

// Audit logs
router.get('/audit-logs', adminMiddleware, getAuditLogs);
router.get('/audit-logs/actions', adminMiddleware, getAuditActions);
router.get('/users/:id/audit-logs', adminMiddleware, getUserAuditLogs);

module.exports = router;
