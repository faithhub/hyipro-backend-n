const pool = require('../config/database');
const { sendEmail } = require('../utils/mailer');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createContactMessage = async (req, res, next) => {
  try {
    const { name, email, message } = req.body || {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    const errors = {};
    if (!trimmedName) errors.name = 'Name is required';
    if (!trimmedEmail) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!trimmedMessage) errors.message = 'Message is required';
    else if (trimmedMessage.length > 2000) errors.message = 'Message must be 2000 characters or fewer';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO contact_messages (name, email, message, status) VALUES (?, ?, ?, 'new')`,
        [trimmedName, trimmedEmail, trimmedMessage]
      );

      try {
        await sendEmail({
          to: trimmedEmail,
          subject: 'Hyipro Contact Request Received',
          html: `
            <p>Hi ${trimmedName},</p>
            <p>Thanks for reaching out to Hyipro. We have received your message and will respond as soon as possible.</p>
            <p><strong>Your message:</strong></p>
            <blockquote style="color:#6b7280;">${trimmedMessage}</blockquote>
            <p>Warm regards,<br/>The Hyipro Support Team</p>
          `,
          text: `Hi ${trimmedName},\n\nThanks for reaching out to Hyipro. We have received your message and will respond as soon as possible.\n\nYour message:\n${trimmedMessage}\n\nWarm regards,\nThe Hyipro Support Team`,
        });
      } catch (mailError) {
        console.error('Contact acknowledgement email failed:', mailError.message);
      }

      res.status(201).json({ message: 'Contact message submitted successfully', id: result.insertId });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const getContactMessages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();
    try {
      const [countResult] = await connection.execute('SELECT COUNT(*) AS total FROM contact_messages');
      const total = countResult[0].total;

      const [contacts] = await connection.execute(
        `SELECT id, name, email, message, status, admin_response, created_at, replied_at
         FROM contact_messages
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({ contacts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const replyContactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { admin_response } = req.body;
    const trimmedResponse = typeof admin_response === 'string' ? admin_response.trim() : '';

    if (!trimmedResponse) {
      return res.status(400).json({ error: 'Reply message is required' });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT id, name, email FROM contact_messages WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Contact message not found' });
      }

      const message = rows[0];
      await connection.execute(
        `UPDATE contact_messages SET admin_response = ?, status = 'replied', replied_at = NOW() WHERE id = ?`,
        [trimmedResponse, id]
      );

      try {
        await sendEmail({
          to: message.email,
          subject: 'Hyipro Support Response',
          html: `
            <p>Hi ${message.name},</p>
            <p>Thank you for contacting Hyipro. Our support team has responded to your message.</p>
            <p><strong>Your original message:</strong></p>
            <blockquote style="color:#6b7280;">${message.message}</blockquote>
            <p><strong>Our response:</strong></p>
            <blockquote style="color:#6b7280;">${trimmedResponse}</blockquote>
            <p>If you have more questions, feel free to reply to this email.</p>
            <p>Warm regards,<br/>The Hyipro Support Team</p>
          `,
          text: `Hi ${message.name},\n\nThank you for contacting Hyipro. Our support team has responded to your message.\n\nYour original message:\n${message.message}\n\nOur response:\n${trimmedResponse}\n\nIf you have more questions, feel free to reply to this email.\n\nWarm regards,\nThe Hyipro Support Team`,
        });
      } catch (mailError) {
        console.error('Admin reply email failed:', mailError.message);
      }

      res.json({ message: 'Reply saved successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createContactMessage,
  getContactMessages,
  replyContactMessage,
};
