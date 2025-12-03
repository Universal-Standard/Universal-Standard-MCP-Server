/**
 * Error Handling Middleware
 * Provides consistent error responses and logging
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

const ERROR_TYPES = {
  VALIDATION: 'ValidationError',
  AUTHENTICATION: 'AuthenticationError',
  AUTHORIZATION: 'AuthorizationError',
  NOT_FOUND: 'NotFoundError',
  RATE_LIMIT: 'RateLimitError',
  PROVIDER: 'ProviderError',
  INTERNAL: 'InternalError',
};

/**
 * Determine error type from error object
 * @param {Error} err - Error object
 * @returns {string} Error type
 */
function getErrorType(err) {
  if (err.name && Object.values(ERROR_TYPES).includes(err.name)) {
    return err.name;
  }
  
  const message = err.message?.toLowerCase() || '';
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return ERROR_TYPES.VALIDATION;
  }
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return ERROR_TYPES.AUTHENTICATION;
  }
  if (message.includes('forbidden') || message.includes('permission')) {
    return ERROR_TYPES.AUTHORIZATION;
  }
  if (message.includes('not found')) {
    return ERROR_TYPES.NOT_FOUND;
  }
  if (message.includes('rate limit')) {
    return ERROR_TYPES.RATE_LIMIT;
  }
  if (message.includes('provider') || message.includes('api key')) {
    return ERROR_TYPES.PROVIDER;
  }
  
  return ERROR_TYPES.INTERNAL;
}

/**
 * Get appropriate HTTP status code for error
 * @param {Error} err - Error object
 * @returns {number} HTTP status code
 */
function getStatusCode(err) {
  if (err.statusCode) return err.statusCode;
  if (err.status) return err.status;
  
  const errorType = getErrorType(err);
  switch (errorType) {
    case ERROR_TYPES.VALIDATION:
      return 400;
    case ERROR_TYPES.AUTHENTICATION:
      return 401;
    case ERROR_TYPES.AUTHORIZATION:
      return 403;
    case ERROR_TYPES.NOT_FOUND:
      return 404;
    case ERROR_TYPES.RATE_LIMIT:
      return 429;
    case ERROR_TYPES.PROVIDER:
      return 503;
    default:
      return 500;
  }
}

/**
 * Central error handling middleware
 * Logs errors and sends consistent JSON responses
 */
function errorHandler(err, req, res, next) {
  const errorId = uuidv4();
  const statusCode = getStatusCode(err);
  const errorType = getErrorType(err);
  
  const logData = {
    errorId,
    errorType,
    statusCode,
    error: err.message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    keyId: req.apiKeyData?.id,
  };
  
  if (statusCode >= 500) {
    logData.stack = err.stack;
    logger.error('Server error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Client error', logData);
  }
  
  if (res.headersSent) {
    return next(err);
  }
  
  const response = {
    error: statusCode >= 500 && config.isProduction ? 'Internal Server Error' : err.message,
    errorType,
    errorId,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  
  if (config.isDevelopment && err.stack) {
    response.stack = err.stack.split('\n').slice(0, 5);
  }
  
  if (err.details) {
    response.details = err.details;
  }
  
  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 * Should be registered after all routes
 */
function notFoundHandler(req, res) {
  logger.debug('Route not found', { 
    method: req.method, 
    path: req.path,
    ip: req.ip 
  });
  
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create a typed error with status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} errorType - Error type from ERROR_TYPES
 * @param {Object} details - Additional error details
 * @returns {Error}
 */
function createError(message, statusCode = 500, errorType = ERROR_TYPES.INTERNAL, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.name = errorType;
  if (details) error.details = details;
  return error;
}

module.exports = { 
  errorHandler, 
  notFoundHandler,
  createError,
  ERROR_TYPES,
  getErrorType,
  getStatusCode
};
