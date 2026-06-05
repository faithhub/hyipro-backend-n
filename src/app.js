const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const csrf = require('csrf');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const planRoutes = require('./routes/plans');
const transactionRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');
const referralRoutes = require('./routes/referrals');
const emailTemplateRoutes = require('./routes/emailTemplates');
const walletRoutes = require('./routes/wallets');
const cryptoRoutes = require('./routes/crypto');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { startDailyEarningsJob } = require('./jobs/dailyEarningsJob');
const { validateEnv } = require('./utils/envValidator');
const { initBlacklist } = require('./utils/tokenBlacklist');
const logger = require('./utils/logger');
const Sentry = require('./utils/sentry');

// Validate environment variables on startup
validateEnv();

// Initialize CSRF protection
// Note: CSRF protection is disabled for now since httpOnly cookies with SameSite=strict
// already provide good CSRF protection. To enable, uncomment and apply to state-changing routes.
// const csrfProtection = csrf({ cookie: true });

const app = express();

// Middleware
app.use(helmet());
app.use(cookieParser());
app.use(morgan('combined'));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://hyipro.online',
  'https://hyipro-frontend.pages.dev',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting configuration from environment variables
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes default
const RATE_LIMIT_REGULAR_MAX = parseInt(process.env.RATE_LIMIT_REGULAR_MAX || '1000');
const RATE_LIMIT_PREMIUM_MAX = parseInt(process.env.RATE_LIMIT_PREMIUM_MAX || '2000');
const RATE_LIMIT_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20');
const RATE_LIMIT_ADMIN_BYPASS = process.env.RATE_LIMIT_ADMIN_BYPASS === 'true';

// Auth routes rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Regular user rate limiter
const regularLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_REGULAR_MAX,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return `user_${decoded.id}`; // Rate limit per user
      } catch {
        return ipKeyGenerator(req);
      }
    }
    return ipKeyGenerator(req);
  }
});

// Premium user rate limiter (higher limit)
const premiumLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_PREMIUM_MAX,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return `user_${decoded.id}`; // Rate limit per user
      } catch {
        return ipKeyGenerator(req);
      }
    }
    return ipKeyGenerator(req);
  }
});

// Middleware to apply appropriate rate limiter based on user role
const applyRateLimit = (req, res, next) => {
  // Skip for admin users if enabled
  if (RATE_LIMIT_ADMIN_BYPASS) {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin') return next();
      } catch {
        // Invalid token, proceed with regular limiter
      }
    }
  }

  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'premium') {
        return premiumLimiter(req, res, next);
      }
    } catch {
      // Invalid token, proceed with regular limiter
    }
  }

  return regularLimiter(req, res, next);
};

// Apply auth limiter to auth routes
app.use('/api/auth', authLimiter);

// Apply role-based rate limiter to all other API routes
app.use('/api/', applyRateLimit);

// Explicit authenticated route for deposit proofs (must come before static middleware)
app.get('/uploads/proofs/:file', authMiddleware, (req, res, next) => {
  const file = req.params.file;
  const roots = [path.join(__dirname, '../uploads/proofs'), path.join(__dirname, '../../uploads/proofs')];
  const trySend = (idx) => {
    if (idx >= roots.length) {
      return res.status(404).json({ error: 'File not found' });
    }
    const options = { root: roots[idx] };
    res.sendFile(file, options, (err) => {
      if (err) {
        return trySend(idx + 1);
      }
    });
  };
  trySend(0);
});

// KYC documents — admin only (contain government IDs and sensitive documents)
app.get('/uploads/kyc/:file', authMiddleware, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const file = req.params.file;
  const roots = [path.join(__dirname, '../uploads/kyc'), path.join(__dirname, '../../uploads/kyc')];
  const trySend = (idx) => {
    if (idx >= roots.length) {
      return res.status(404).json({ error: 'File not found' });
    }
    const options = { root: roots[idx] };
    res.sendFile(file, options, (err) => {
      if (err) {
        return trySend(idx + 1);
      }
    });
  };
  trySend(0);
});

// All remaining /uploads/* paths require authentication — no unauthenticated static serving
app.use('/uploads', authMiddleware, express.static(path.join(__dirname, '../uploads')));
app.use('/uploads', authMiddleware, express.static(path.join(__dirname, '../../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/crypto', cryptoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Sentry error handler (must be after errorHandler)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Start background jobs
startDailyEarningsJob();

// Load token blacklist from DB into memory
initBlacklist().catch((err) => console.error('[startup] Failed to init token blacklist:', err.message));

logger.info('Application initialized', {
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000
});

module.exports = app;
