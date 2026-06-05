const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');
const { validateImageFile } = require('../utils/fileMagic');

const proofsDir = path.join(__dirname, '../../uploads/proofs');
if (!fs.existsSync(proofsDir)) {
  fs.mkdirSync(proofsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: proofsDir,
  filename: (req, file, cb) => {
    const depositId = req.params.depositId || 'unknown';
    const ts = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `deposit-${depositId}-${ts}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif', 'image/x-heic', 'image/x-heif',
      'application/octet-stream'
    ];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedByExt = allowedExtensions.includes(ext);
    const isAllowedByMime = file.mimetype.startsWith('image/') || allowedMimes.includes(file.mimetype);
    if (!isAllowedByExt && !isAllowedByMime) {
      return cb(new Error('Only image files are allowed (PNG, JPG, GIF, WEBP, HEIC, HEIF)'));
    }
    cb(null, true);
  }
});

// Wraps multer and adds magic-byte validation after the file is written to disk
const uploadProofMiddleware = (req, res, next) => {
  upload.single('proof_image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // HEIC/HEIF files don't have well-known magic bytes — skip magic check for them
    const ext = path.extname(req.file.originalname).toLowerCase();
    const skipMagicCheck = ['.heic', '.heif'].includes(ext);
    if (!skipMagicCheck && !validateImageFile(req.file.path, ['jpeg', 'png', 'gif', 'webp'])) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Uploaded file is not a valid image' });
    }
    next();
  });
};

router.post('/initiate-deposit', authMiddleware, transactionController.initiateDeposit);
router.get('/deposit/:depositId', authMiddleware, transactionController.getDepositById);
router.get('/deposit/:depositId/proof', authMiddleware, transactionController.getProofFile);
router.post('/deposit/:depositId/upload-proof', authMiddleware, uploadProofMiddleware, transactionController.uploadProof);
router.get('/deposits/pending', authMiddleware, transactionController.getPendingDeposits);

router.post('/withdraw', authMiddleware, transactionController.requestWithdrawal);
router.get('/withdrawal-requests', authMiddleware, transactionController.getWithdrawalRequests);

router.post('/admin/deposits/:depositId/confirm', authMiddleware, adminMiddleware, transactionController.adminConfirmDeposit);
router.post('/admin/deposits/:depositId/reject', authMiddleware, adminMiddleware, transactionController.adminRejectDeposit);
router.post('/admin/withdrawals/:withdrawalId/approve', authMiddleware, adminMiddleware, transactionController.adminApproveWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/reject', authMiddleware, adminMiddleware, transactionController.adminRejectWithdrawal);

module.exports = router;
