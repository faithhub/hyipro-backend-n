const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

router.post('/register', validate('register'), authController.register);
router.post('/login', validate('login'), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/request-password-reset', validate('requestPasswordReset'), authController.requestPasswordReset);
router.post('/reset-password', validate('resetPassword'), authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
