// Email template utilities with variable substitution

const templates = {
  // Registration confirmation email
  registration: (userName, verifyLink) => ({
    subject: 'Welcome to Hyipro - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to Hyipro</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="color: #1f2937; font-size: 16px;">Hi ${userName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Thank you for registering with Hyipro! We're excited to have you on board. Your account is ready to use, and you can start exploring our investment plans right away.</p>
          
          <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #4b5563; margin: 0 0 15px 0;">Click the button below to verify your email address:</p>
            <a href="${verifyLink}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
          </div>

          <p style="color: #4b5563; line-height: 1.6;">If you didn't create this account, please ignore this email.</p>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Hyipro Investment Platform</p>
            <p style="margin: 5px 0 0 0;">© 2026 All rights reserved</p>
          </div>
        </div>
      </div>
    `,
    text: `Welcome to Hyipro!\n\nHi ${userName},\n\nThank you for registering with Hyipro! Your account is ready to use.\n\nVerify your email: ${verifyLink}\n\nIf you didn't create this account, please ignore this email.\n\nBest regards,\nThe Hyipro Team`
  }),

  // Deposit confirmation email
  deposit: (userName, amount, cryptoType, status, txHash) => ({
    subject: `Deposit Confirmation - ${amount} USD in ${cryptoType}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Deposit Received</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="color: #1f2937; font-size: 16px;">Hi ${userName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Your deposit has been received and is being processed.</p>
          
          <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #4b5563;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                <td style="padding: 8px 0; text-align: right;">$${parseFloat(amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Crypto Type:</td>
                <td style="padding: 8px 0; text-align: right;">${cryptoType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0; text-align: right; color: #10b981; font-weight: bold;">${status.toUpperCase()}</td>
              </tr>
              ${txHash ? `<tr>
                <td style="padding: 8px 0; font-weight: bold;">Transaction Hash:</td>
                <td style="padding: 8px 0; text-align: right; font-size: 12px; word-break: break-all;">${txHash}</td>
              </tr>` : ''}
            </table>
          </div>

          <p style="color: #4b5563; line-height: 1.6;">Once your deposit is confirmed, you'll be able to activate your subscription and start earning returns.</p>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Hyipro Investment Platform</p>
            <p style="margin: 5px 0 0 0;">© 2026 All rights reserved</p>
          </div>
        </div>
      </div>
    `,
    text: `Deposit Confirmation\n\nHi ${userName},\n\nYour deposit has been received.\n\nAmount: $${parseFloat(amount).toFixed(2)}\nCrypto Type: ${cryptoType}\nStatus: ${status.toUpperCase()}\n${txHash ? `Transaction Hash: ${txHash}\n` : ''}\nOnce confirmed, you can activate your subscription.\n\nBest regards,\nThe Hyipro Team`
  }),

  // Withdrawal confirmation email
  withdrawal: (userName, amount, walletAddress, status) => ({
    subject: `Withdrawal Request Confirmed - ${amount} USD`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Withdrawal Request</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="color: #1f2937; font-size: 16px;">Hi ${userName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Your withdrawal request has been submitted and is being processed.</p>
          
          <div style="background: white; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #4b5563;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                <td style="padding: 8px 0; text-align: right;">$${parseFloat(amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Wallet Address:</td>
                <td style="padding: 8px 0; text-align: right; font-size: 12px; word-break: break-all;">${walletAddress}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0; text-align: right; color: #f59e0b; font-weight: bold;">${status.toUpperCase()}</td>
              </tr>
            </table>
          </div>

          <p style="color: #4b5563; line-height: 1.6;">Your withdrawal is being processed. You'll receive another email once it's completed. Processing typically takes 1-3 business days.</p>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Hyipro Investment Platform</p>
            <p style="margin: 5px 0 0 0;">© 2026 All rights reserved</p>
          </div>
        </div>
      </div>
    `,
    text: `Withdrawal Request Confirmed\n\nHi ${userName},\n\nYour withdrawal request has been submitted.\n\nAmount: $${parseFloat(amount).toFixed(2)}\nWallet Address: ${walletAddress}\nStatus: ${status.toUpperCase()}\n\nProcessing typically takes 1-3 business days.\n\nBest regards,\nThe Hyipro Team`
  }),

  // KYC approval email
  kycApproved: (userName) => ({
    subject: 'KYC Verification Approved',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">KYC Approved</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="color: #1f2937; font-size: 16px;">Hi ${userName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Congratulations! Your KYC (Know Your Customer) verification has been approved.</p>
          
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #047857; margin: 0; font-weight: bold;">✓ Your account is now fully verified</p>
          </div>

          <p style="color: #4b5563; line-height: 1.6;">You can now:</p>
          <ul style="color: #4b5563; line-height: 1.8;">
            <li>Make deposits and withdrawals without restrictions</li>
            <li>Subscribe to all investment plans</li>
            <li>Withdraw your earnings anytime</li>
          </ul>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Hyipro Investment Platform</p>
            <p style="margin: 5px 0 0 0;">© 2026 All rights reserved</p>
          </div>
        </div>
      </div>
    `,
    text: `KYC Verification Approved\n\nHi ${userName},\n\nCongratulations! Your KYC verification has been approved.\n\nYou can now:\n- Make deposits and withdrawals\n- Subscribe to investment plans\n- Withdraw your earnings\n\nBest regards,\nThe Hyipro Team`
  }),

  // KYC rejection email
  kycRejected: (userName, reason) => ({
    subject: 'KYC Verification - Please Resubmit',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">KYC Resubmission Required</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="color: #1f2937; font-size: 16px;">Hi ${userName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Your KYC verification was not approved. Please review the feedback below and resubmit your documents.</p>
          
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #7f1d1d; margin: 0 0 10px 0; font-weight: bold;">Reason for rejection:</p>
            <p style="color: #7f1d1d; margin: 0;">${reason}</p>
          </div>

          <p style="color: #4b5563; line-height: 1.6;">Please log in to your account and resubmit your KYC documents. Make sure all documents are:</p>
          <ul style="color: #4b5563; line-height: 1.8;">
            <li>Clear and legible</li>
            <li>Not expired</li>
            <li>Properly formatted (JPG, PNG, or PDF)</li>
          </ul>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Hyipro Investment Platform</p>
            <p style="margin: 5px 0 0 0;">© 2026 All rights reserved</p>
          </div>
        </div>
      </div>
    `,
    text: `KYC Verification - Please Resubmit\n\nHi ${userName},\n\nYour KYC verification was not approved.\n\nReason: ${reason}\n\nPlease log in and resubmit your documents. Ensure they are clear, legible, and not expired.\n\nBest regards,\nThe Hyipro Team`
  }),

  // Subscription activated email
  subscriptionActivated: (userName, planName, amount, dailyProfit, endDate) => ({
    subject: `Subscription Activated - ${planName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Subscription Activated</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="color: #1f2937; font-size: 16px;">Hi ${userName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Your subscription to the ${planName} plan is now active! Your investment is working for you.</p>
          
          <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #4b5563;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Plan:</td>
                <td style="padding: 8px 0; text-align: right;">${planName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Investment Amount:</td>
                <td style="padding: 8px 0; text-align: right;">$${parseFloat(amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Daily Profit:</td>
                <td style="padding: 8px 0; text-align: right; color: #10b981; font-weight: bold;">${dailyProfit}%</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">End Date:</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(endDate).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>

          <p style="color: #4b5563; line-height: 1.6;">Your earnings will be calculated daily and credited to your account. You can view your earnings and withdraw anytime from your dashboard.</p>
          
          <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Hyipro Investment Platform</p>
            <p style="margin: 5px 0 0 0;">© 2026 All rights reserved</p>
          </div>
        </div>
      </div>
    `,
    text: `Subscription Activated\n\nHi ${userName},\n\nYour subscription to ${planName} is now active!\n\nPlan: ${planName}\nInvestment: $${parseFloat(amount).toFixed(2)}\nDaily Profit: ${dailyProfit}%\nEnd Date: ${new Date(endDate).toLocaleDateString()}\n\nYour earnings will be calculated daily. Check your dashboard to view and withdraw earnings.\n\nBest regards,\nThe Hyipro Team`
  })
};

module.exports = templates;
