const express = require('express');
const router = express.Router();
const cryptoController = require('../controllers/cryptoController');

// Public routes
router.get('/prices', cryptoController.getPrices);
router.get('/convert/usd-to-btc', cryptoController.convertUsdToBtc);
router.get('/convert/usd-to-eth', cryptoController.convertUsdToEth);
router.get('/convert/crypto-to-usd', cryptoController.convertCryptoToUsd);

// Admin routes (require admin middleware)
const { adminMiddleware } = require('../middleware/auth');
router.post('/admin/clear-cache', adminMiddleware, cryptoController.clearCache);
router.post('/admin/update-fallback', adminMiddleware, cryptoController.updateFallbackPrices);

module.exports = router;
