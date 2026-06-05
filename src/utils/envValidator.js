require('dotenv').config();

const validateEnv = () => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  const optionalVars = [
    'FRONTEND_URL',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_FROM',
    'RESET_PASSWORD_EXPIRE',
    'RESET_PASSWORD_EXPIRE_SECONDS'
  ];

  const missing = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these variables in your .env file and restart the server.');
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET is too short. It should be at least 32 characters for security.');
  }

  console.log('✅ Environment variables validated successfully');
};

module.exports = { validateEnv };
