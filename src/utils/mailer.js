const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@hyipro.com';

  await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
    text,
  });
};

module.exports = {
  sendEmail,
};
