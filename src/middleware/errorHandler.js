const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const errorId = require('uuid').v4();
  
  logger.error('Unhandled error', {
    errorId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  
  if (res.headersSent) {
    return next(err);
  }
  
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message;
  
  res.status(statusCode).json({
    error: message,
    errorId,
    timestamp: new Date().toISOString(),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`,
  });
}

module.exports = { errorHandler, notFoundHandler };
