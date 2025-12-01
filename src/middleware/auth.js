const config = require('../config');
const logger = require('../utils/logger');
const { validateApiKey: getKeyData, addApiKey } = require('./apiKeys');

function validateApiKey(req, res, next) {
  const apiKey = req.headers[config.security.apiKeyHeader.toLowerCase()];
  
  if (!apiKey) {
    logger.warn('Request without API key', { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Include it in the X-API-Key header.',
    });
  }
  
  const keyData = getKeyData(apiKey);
  if (!keyData) {
    logger.warn('Invalid API key used', { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key.',
    });
  }
  
  req.apiKeyData = keyData;
  next();
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiKeyData || !req.apiKeyData.scopes.includes(scope)) {
      logger.warn('Insufficient permissions', { 
        ip: req.ip, 
        path: req.path, 
        requiredScope: scope 
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required scope: ${scope}`,
      });
    }
    next();
  };
}

module.exports = { validateApiKey, requireScope, addApiKey };
