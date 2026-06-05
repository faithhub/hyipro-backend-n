const { Resend } = require('resend');

let resend = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('⚠️ RESEND_API_KEY not set - email functionality disabled');
}

const sendEmail = async ({ to, subject, html, text }) => {
  if (!resend) {
    console.warn('⚠️ Email skipped - RESEND_API_KEY not configured');
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@hyipro.com';

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
};

module.exports = {
  sendEmail,
};
