const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.errorFile = path.join(logsDir, 'error.log');
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
  }

  writeToFile(file, message) {
    fs.appendFile(file, message, (err) => {
      if (err) console.error('Failed to write to log file:', err);
    });
  }

  error(message, meta = {}) {
    const formatted = this.formatMessage(logLevels.ERROR, message, meta);
    console.error(formatted);
    this.writeToFile(this.logFile, formatted);
    this.writeToFile(this.errorFile, formatted);
  }

  warn(message, meta = {}) {
    const formatted = this.formatMessage(logLevels.WARN, message, meta);
    console.warn(formatted);
    this.writeToFile(this.logFile, formatted);
  }

  info(message, meta = {}) {
    const formatted = this.formatMessage(logLevels.INFO, message, meta);
    console.log(formatted);
    this.writeToFile(this.logFile, formatted);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage(logLevels.DEBUG, message, meta);
      console.log(formatted);
      this.writeToFile(this.logFile, formatted);
    }
  }

  // Specific logging methods for common actions
  userAction(userId, action, details = {}) {
    this.info(`User Action: ${action}`, { userId, ...details });
  }

  transaction(transactionId, type, status, details = {}) {
    this.info(`Transaction: ${type} - ${status}`, { transactionId, ...details });
  }

  apiError(endpoint, error, details = {}) {
    this.error(`API Error: ${endpoint}`, {
      error: error.message,
      stack: error.stack,
      ...details
    });
  }

  databaseError(query, error, details = {}) {
    this.error(`Database Error`, {
      query: query.substring(0, 100),
      error: error.message,
      ...details
    });
  }
}

module.exports = new Logger();
