const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const nodemailer = require('nodemailer');
const { addToBlacklist } = require('../utils/tokenBlacklist');
const { logAudit } = require('../utils/auditLog');

const generateToken = (user) => {
  const payload = {
    jti: crypto.randomUUID(),
    id: user.id,
    email: user.email,
    role: user.role,
  };
  if (user.status) payload.status = user.status;
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generatePasswordResetToken = (email) => {
  return jwt.sign(
    { email, type: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.RESET_PASSWORD_EXPIRE || '15m' }
  );
};

const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP configuration is missing');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendPasswordResetEmail = async (email, resetUrl) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Hyipro Password Reset',
    html: `
      <p>Hello,</p>
      <p>You requested a password reset for your Hyipro account.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>If you did not request this, you can safely ignore this message.</p>
    `,
  });
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      // Do not reveal whether an email is registered. If the email does not exist,
      // return a generic success response so callers cannot enumerate accounts.
      if (users.length === 0) {
        return res.json({ message: 'If that email is registered, a password reset link has been sent.' });
      }

      const user = users[0];
      const resetToken = generatePasswordResetToken(email);
      const tokenHash = hashResetToken(resetToken);
      const expiresInSeconds = parseInt(process.env.RESET_PASSWORD_EXPIRE_SECONDS || '900', 10);
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || null;
      const ua = req.headers['user-agent'] || null;

      let inserted = false;
      try {
        await connection.execute(
          `INSERT INTO password_reset_requests (user_id, email, token_hash, status, requested_ip, user_agent, expires_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
          [user.id, email, tokenHash, ip, ua, expiresAt]
        );
        inserted = true;
      } catch (dbErr) {
        // If the table doesn't exist or another DB error occurs, log and continue.
        console.error('Password reset insert failed:', dbErr.message);
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;

      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (mailError) {
        console.error('Failed to send password reset email:', mailError.message);
        if (inserted) {
          try {
            await connection.execute(
              'UPDATE password_reset_requests SET status = ? WHERE user_id = ? AND token_hash = ?',
              ['failed', user.id, tokenHash]
            );
          } catch (updateErr) {
            console.error('Failed to mark password_reset_requests as failed:', updateErr.message);
          }
        }
        // Do not throw — respond with generic success so callers cannot detect failures.
      }

      res.json({ message: 'If that email is registered, a password reset link has been sent.' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (payload.type !== 'password_reset' || !payload.email) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const tokenHash = hashResetToken(token);
    const connection = await pool.getConnection();

    try {
      const [requests] = await connection.execute(
        `SELECT id, user_id, status, expires_at FROM password_reset_requests
         WHERE token_hash = ? AND status = 'pending'`,
        [tokenHash]
      );

      if (requests.length === 0) {
        return res.status(400).json({ error: 'Invalid or already used reset token' });
      }

      const requestRecord = requests[0];
      if (requestRecord.expires_at && new Date(requestRecord.expires_at) < new Date()) {
        await connection.execute(
          'UPDATE password_reset_requests SET status = ? WHERE id = ?',
          ['expired', requestRecord.id]
        );
        return res.status(400).json({ error: 'Reset token has expired' });
      }

      const [users] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [payload.email]
      );

      if (users.length === 0) {
        return res.status(400).json({ error: 'Invalid reset token' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await connection.execute(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [hashedPassword, payload.email]
      );

      await connection.execute(
        'UPDATE password_reset_requests SET status = ?, used_at = ? WHERE id = ?',
        ['completed', new Date(), requestRecord.id]
      );

      logAudit(req, 'auth.password_reset', { userId: users[0].id, entityType: 'user', entityId: users[0].id });

      res.json({ message: 'Password reset successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, country, referral_code } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const connection = await pool.getConnection();

    try {
      // Check if user exists
      const [existingUser] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUser.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // // Hash password
      // const hashedPassword = await bcrypt.hash(password, 12);

      // // Create user
      // const [result] = await connection.execute(
      //   'INSERT INTO users (email, password_hash, first_name, last_name, country) VALUES (?, ?, ?, ?, ?)',
      //   [email, hashedPassword, first_name || null, last_name || null, country || null]
      // );

      // const userId = result.insertId;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Generate unique referral code for this user
      const crypto = require('crypto');
      // const userReferralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const userReferralCode = 'HYIPRO' + crypto.randomBytes(3).toString('hex').toUpperCase();

      // Create user
      const [result] = await connection.execute(
        'INSERT INTO users (email, password_hash, first_name, last_name, country, referral_code) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, first_name || null, last_name || null, country || null, userReferralCode]
      );
      const userId = result.insertId;

      logAudit(req, 'auth.register', { userId, entityType: 'user', entityId: userId, metadata: { country: country || null } });

      // Create wallet for user
      await connection.execute(
        'INSERT INTO wallets (user_id) VALUES (?)',
        [userId]
      );

      // Handle referral if referral code is provided
      // if (referral_code) {
      //   try {
      //     // Find referrer by referral code
      //     const [referrers] = await connection.execute(
      //       `SELECT referrer_id FROM referrals WHERE referral_code = ? LIMIT 1`,
      //       [referral_code]
      //     );

      //     if (referrers.length > 0) {
      //       const referrer_id = referrers[0].referrer_id;

      //       // Create referral record
      //       await connection.execute(
      //         `INSERT INTO referrals (referrer_id, referred_user_id, referral_code, status)
      //          VALUES (?, ?, ?, 'active')`,
      //         [referrer_id, userId, referral_code]
      //       );
      //       console.log(`✅ Referral created: User ${userId} referred by ${referrer_id}`);
      //     }
      //   } catch (referralError) {
      //     console.error('Error processing referral:', referralError.message);
      //     // Don't fail registration if referral processing fails
      //   }
      // }

      if (referral_code) {
        try {
          // Find referrer by their referral code stored on users table
          const [referrers] = await connection.execute(
            `SELECT id FROM users WHERE referral_code = ? LIMIT 1`,
            [referral_code]
          );
          if (referrers.length > 0) {
            const referrer_id = referrers[0].id;
            await connection.execute(
              `INSERT INTO referrals (referrer_id, referred_user_id, referral_code, status)
            VALUES (?, ?, ?, 'active')`,
              [referrer_id, userId, referral_code]
            );
            console.log(`✅ Referral created: User ${userId} referred by ${referrer_id}`);
          }
        } catch (referralError) {
          console.error('Error processing referral:', referralError.message);
        }
      }

      // Get created user
      const [newUser] = await connection.execute(
        'SELECT id, email, role FROM users WHERE id = ?',
        [userId]
      );

      const token = generateToken(newUser[0]);

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: newUser[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute(
        'SELECT id, email, password_hash, role, status, last_login, last_ip, user_agent, failed_login_attempts, locked_until FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = users[0];

      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account is suspended' });
      }

      // Check account lockout
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const retryAfter = Math.ceil((new Date(user.locked_until) - Date.now()) / 1000 / 60);
        return res.status(429).json({
          error: `Account temporarily locked due to too many failed attempts. Try again in ${retryAfter} minute(s).`
        });
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          await connection.execute(
            'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
            [newAttempts, lockedUntil, user.id]
          );
        } else {
          await connection.execute(
            'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
            [newAttempts, user.id]
          );
        }
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Successful login — reset lockout counters
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || null;
      const ua = req.headers['user-agent'] || null;
      await connection.execute(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW(), last_ip = ?, user_agent = ?, updated_at = NOW() WHERE id = ?',
        [ip, ua, user.id]
      );

      logAudit(req, 'auth.login', { userId: user.id, entityType: 'user', entityId: user.id });

      const token = generateToken(user);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          last_login: new Date().toISOString(),
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Re-fetch current user from DB — do not blindly re-sign stale payload
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.execute(
        'SELECT id, email, role, status FROM users WHERE id = ?',
        [decoded.id]
      );
      if (users.length === 0) {
        return res.status(401).json({ error: 'Account not found' });
      }
      const user = users[0];
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account is suspended' });
      }
      const newToken = generateToken(user);
      res.json({ message: 'Token refreshed', token: newToken });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Token is already expired or invalid — treat as logged out
      return res.json({ message: 'Logged out successfully' });
    }

    if (decoded.jti && decoded.exp) {
      await addToBlacklist(decoded.jti, decoded.id, decoded.exp);
    }

    logAudit(req, 'auth.logout', { userId: decoded.id, entityType: 'user', entityId: decoded.id });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  refreshToken
};
