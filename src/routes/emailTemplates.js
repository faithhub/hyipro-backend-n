const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/emailTemplateController');
const { authMiddleware } = require('../middleware/auth');

// Get all available templates
router.get('/', authMiddleware, emailTemplateController.getTemplates);

// Get template preview with sample data
router.get('/:templateId/preview', authMiddleware, emailTemplateController.getTemplatePreview);

// Send test email
router.post('/test', authMiddleware, emailTemplateController.sendTestEmail);

module.exports = router;
