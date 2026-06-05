const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { validateImageFile } = require('../utils/fileMagic');

const uploadDir = path.join(__dirname, '../../uploads/kyc');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase();
    cb(null, `${req.user.id}-${timestamp}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Wraps multer and adds magic-byte validation after the file is written to disk
const uploadKycMiddleware = (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!validateImageFile(req.file.path, ['jpeg', 'png'])) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Uploaded file is not a valid JPEG or PNG image' });
    }
    next();
  });
};

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.put('/password', authMiddleware, userController.changePassword);
router.get('/wallet', authMiddleware, userController.getWallet);
router.get('/wallet/balance', authMiddleware, userController.getWalletBalance);
router.put('/wallet', authMiddleware, userController.updateWallet);
router.get('/subscriptions', authMiddleware, userController.getSubscriptions);
router.get('/active-subscriptions', authMiddleware, userController.getActiveSubscriptions);
router.post('/subscriptions/create', authMiddleware, userController.createSubscription);
router.get('/earnings', authMiddleware, userController.getEarnings);
router.post('/earnings/transfer-to-wallet', authMiddleware, userController.transferEarningsToWallet);
router.get('/transactions', authMiddleware, userController.getTransactions);
router.get('/kyc', authMiddleware, userController.getKycStatus);
router.post('/kyc/documents', authMiddleware, uploadKycMiddleware, userController.uploadKycDocument);
router.post('/withdraw', authMiddleware, userController.createWithdrawal);
router.get('/withdrawal-requests', authMiddleware, userController.getWithdrawalRequests);

module.exports = router;
