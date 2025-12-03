/**
 * Winston Logger Configuration
 * Provides structured logging with environment-aware formatting
 */
const winston = require('winston');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(LOG_COLORS);

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: logLevel,
  format: isDevelopment ? devFormat : prodFormat,
  defaultMeta: { service: 'spurs-mcp-server' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

/**
 * Create a child logger with additional default metadata
 * @param {Object} meta - Additional metadata to include in all logs
 * @returns {winston.Logger}
 */
logger.child = function(meta) {
  return winston.createLogger({
    levels: LOG_LEVELS,
    level: logLevel,
    format: isDevelopment ? devFormat : prodFormat,
    defaultMeta: { service: 'spurs-mcp-server', ...meta },
    transports: this.transports,
  });
};

/**
 * Log HTTP request (for morgan integration)
 */
logger.http = logger.http || function(message, meta) {
  this.log('http', message, meta);
};

/**
 * Measure and log operation duration
 * @param {string} operation - Operation name
 * @returns {Function} Call to end timing and log
 */
logger.startTimer = function(operation) {
  const start = Date.now();
  return (meta = {}) => {
    const duration = Date.now() - start;
    this.debug(`${operation} completed`, { ...meta, duration: `${duration}ms` });
  };
};

module.exports = logger;
