const winston = require('winston');

// Log levels in order of increasing verbosity
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Get log level from environment variable or default to info
const level = process.env.LOG_LEVEL || 'info';

// Create custom format without emojis and with cleaner output
const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`.trim();
  })
);

// Create logger instance
const logger = winston.createLogger({
  level,
  levels,
  format,
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = logger;