const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.get('/company', walletController.getCompanyWallets);
router.post('/company/update', authMiddleware, adminMiddleware, walletController.updateCompanyWallets);

module.exports = router;
