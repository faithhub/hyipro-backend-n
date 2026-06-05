const templates = require('../utils/emailTemplates');
const { sendEmail } = require('../utils/mailer');

const emailTemplateController = {
  // Get all available templates
  getTemplates: (req, res) => {
    const availableTemplates = [
      {
        id: 'registration',
        name: 'Registration Confirmation',
        description: 'Welcome email sent to new users with email verification link',
        variables: ['userName', 'verifyLink'],
      },
      {
        id: 'deposit',
        name: 'Deposit Confirmation',
        description: 'Confirmation email sent when user makes a deposit',
        variables: ['userName', 'amount', 'cryptoType', 'status', 'txHash'],
      },
      {
        id: 'withdrawal',
        name: 'Withdrawal Confirmation',
        description: 'Confirmation email sent when user requests a withdrawal',
        variables: ['userName', 'amount', 'walletAddress', 'status'],
      },
      {
        id: 'kycApproved',
        name: 'KYC Approval',
        description: 'Email sent when user KYC is approved',
        variables: ['userName'],
      },
      {
        id: 'kycRejected',
        name: 'KYC Rejection',
        description: 'Email sent when user KYC is rejected with reason to resubmit',
        variables: ['userName', 'reason'],
      },
      {
        id: 'subscriptionActivated',
        name: 'Subscription Activated',
        description: 'Email sent when user subscription plan is activated',
        variables: ['userName', 'planName', 'amount', 'dailyProfit', 'endDate'],
      },
    ];

    res.json({ templates: availableTemplates });
  },

  // Get template preview
  getTemplatePreview: (req, res) => {
    const { templateId } = req.params;

    try {
      let template;
      let sampleData = {};

      switch (templateId) {
        case 'registration':
          sampleData = {
            userName: 'John Doe',
            verifyLink: 'https://hyipro.com/verify?token=abc123xyz',
          };
          template = templates.registration(sampleData.userName, sampleData.verifyLink);
          break;

        case 'deposit':
          sampleData = {
            userName: 'John Doe',
            amount: '5000',
            cryptoType: 'Bitcoin',
            status: 'confirmed',
            txHash: 'abc123def456',
          };
          template = templates.deposit(
            sampleData.userName,
            sampleData.amount,
            sampleData.cryptoType,
            sampleData.status,
            sampleData.txHash
          );
          break;

        case 'withdrawal':
          sampleData = {
            userName: 'John Doe',
            amount: '2500',
            walletAddress: '1A1z7agoat2Bt89ZN1M1a51LBeB3TubqV',
            status: 'processing',
          };
          template = templates.withdrawal(
            sampleData.userName,
            sampleData.amount,
            sampleData.walletAddress,
            sampleData.status
          );
          break;

        case 'kycApproved':
          sampleData = {
            userName: 'John Doe',
          };
          template = templates.kycApproved(sampleData.userName);
          break;

        case 'kycRejected':
          sampleData = {
            userName: 'John Doe',
            reason: 'Document quality is not clear. Please resubmit with higher resolution images.',
          };
          template = templates.kycRejected(sampleData.userName, sampleData.reason);
          break;

        case 'subscriptionActivated':
          sampleData = {
            userName: 'John Doe',
            planName: 'Professional Plan',
            amount: '5000',
            dailyProfit: '50-100',
            endDate: '2026-12-01',
          };
          template = templates.subscriptionActivated(
            sampleData.userName,
            sampleData.planName,
            sampleData.amount,
            sampleData.dailyProfit,
            sampleData.endDate
          );
          break;

        default:
          return res.status(400).json({ error: 'Invalid template ID' });
      }

      res.json({
        templateId,
        sampleData,
        template,
      });
    } catch (error) {
      res.status(500).json({ error: 'Error generating template preview', details: error.message });
    }
  },

  // Send test email
  sendTestEmail: async (req, res) => {
    const { templateId, testEmail, customData } = req.body;

    if (!templateId || !testEmail) {
      return res.status(400).json({ error: 'Template ID and test email are required' });
    }

    try {
      let template;
      let data = customData || {};

      // Set default values if not provided
      switch (templateId) {
        case 'registration':
          data = {
            userName: data.userName || 'Test User',
            verifyLink: data.verifyLink || 'https://hyipro.com/verify?token=test123',
          };
          template = templates.registration(data.userName, data.verifyLink);
          break;

        case 'deposit':
          data = {
            userName: data.userName || 'Test User',
            amount: data.amount || '5000',
            cryptoType: data.cryptoType || 'Bitcoin',
            status: data.status || 'confirmed',
            txHash: data.txHash || 'test_tx_hash_123',
          };
          template = templates.deposit(
            data.userName,
            data.amount,
            data.cryptoType,
            data.status,
            data.txHash
          );
          break;

        case 'withdrawal':
          data = {
            userName: data.userName || 'Test User',
            amount: data.amount || '2500',
            walletAddress: data.walletAddress || '1A1z7agoat2Bt89ZN1M1a51LBeB3TubqV',
            status: data.status || 'processing',
          };
          template = templates.withdrawal(
            data.userName,
            data.amount,
            data.walletAddress,
            data.status
          );
          break;

        case 'kycApproved':
          data = {
            userName: data.userName || 'Test User',
          };
          template = templates.kycApproved(data.userName);
          break;

        case 'kycRejected':
          data = {
            userName: data.userName || 'Test User',
            reason: data.reason || 'Document quality is not clear',
          };
          template = templates.kycRejected(data.userName, data.reason);
          break;

        case 'subscriptionActivated':
          data = {
            userName: data.userName || 'Test User',
            planName: data.planName || 'Professional Plan',
            amount: data.amount || '5000',
            dailyProfit: data.dailyProfit || '50-100',
            endDate: data.endDate || '2026-12-01',
          };
          template = templates.subscriptionActivated(
            data.userName,
            data.planName,
            data.amount,
            data.dailyProfit,
            data.endDate
          );
          break;

        default:
          return res.status(400).json({ error: 'Invalid template ID' });
      }

      // Send the test email
      await sendEmail({
        to: testEmail,
        ...template,
      });

      res.json({
        success: true,
        message: `Test email sent to ${testEmail}`,
        templateId,
        data,
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({
        error: 'Error sending test email',
        details: error.message,
      });
    }
  },
};

module.exports = emailTemplateController;
