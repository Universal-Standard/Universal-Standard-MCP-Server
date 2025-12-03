/**
 * Authentication Middleware
 * Handles API key validation and scope-based authorization
 */
const config = require('../config');
const logger = require('../utils/logger');
const { validateApiKey: getKeyData, addApiKey, VALID_SCOPES } = require('./apiKeys');

/**
 * Check if user has required scope (supports admin:* wildcard)
 * @param {string[]} userScopes - Scopes assigned to user
 * @param {string} requiredScope - Scope required for access
 * @returns {boolean}
 */
function hasScope(userScopes, requiredScope) {
  if (!Array.isArray(userScopes)) return false;
  
  if (userScopes.includes('admin:*')) {
    return true;
  }
  
  if (userScopes.includes(requiredScope)) {
    return true;
  }
  
  const [category] = requiredScope.split(':');
  if (userScopes.includes(`${category}:*`)) {
    return true;
  }
  
  return false;
}

/**
 * Middleware to validate API key from request headers
 * Attaches validated key data to req.apiKeyData
 */
async function validateApiKey(req, res, next) {
  const headerName = config.security.apiKeyHeader.toLowerCase();
  const apiKey = req.headers[headerName];
  
  if (!apiKey) {
    logger.warn('Request without API key', { 
      ip: req.ip, 
      path: req.path,
      method: req.method 
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Include it in the X-API-Key header.',
      statusCode: 401,
    });
  }
  
  if (typeof apiKey !== 'string' || apiKey.length < 8) {
    logger.warn('Malformed API key', { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format.',
      statusCode: 401,
    });
  }
  
  try {
    const keyData = await getKeyData(apiKey);
    if (!keyData) {
      logger.warn('Invalid API key used', { 
        ip: req.ip, 
        path: req.path,
        keyPrefix: apiKey.substring(0, 8) + '...'
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key.',
        statusCode: 401,
      });
    }
    
    req.apiKeyData = keyData;
    next();
  } catch (error) {
    logger.error('Error validating API key', { 
      error: error.message,
      stack: error.stack,
      ip: req.ip 
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate API key.',
      statusCode: 500,
    });
  }
}

/**
 * Middleware factory to require specific scope
 * @param {string} scope - Required scope for access
 * @returns {Function} Express middleware
 */
function requireScope(scope) {
  if (!VALID_SCOPES.includes(scope) && !scope.endsWith(':*')) {
    logger.warn(`Unknown scope configured: ${scope}`);
  }
  
  return (req, res, next) => {
    if (!req.apiKeyData) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }
    
    if (!hasScope(req.apiKeyData.scopes, scope)) {
      logger.warn('Insufficient permissions', { 
        ip: req.ip, 
        path: req.path,
        method: req.method,
        requiredScope: scope,
        userScopes: req.apiKeyData.scopes,
        keyId: req.apiKeyData.id,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required scope: ${scope}`,
        requiredScope: scope,
        statusCode: 403,
      });
    }
    next();
  };
}

/**
 * Middleware factory to require any of multiple scopes
 * @param {string[]} scopes - Array of acceptable scopes
 * @returns {Function} Express middleware
 */
function requireAnyScope(scopes) {
  return (req, res, next) => {
    if (!req.apiKeyData) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }
    
    const hasAnyScope = scopes.some(scope => hasScope(req.apiKeyData.scopes, scope));
    
    if (!hasAnyScope) {
      logger.warn('Insufficient permissions', { 
        ip: req.ip, 
        path: req.path,
        requiredScopes: scopes,
        userScopes: req.apiKeyData.scopes,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required one of: ${scopes.join(', ')}`,
        statusCode: 403,
      });
    }
    next();
  };
}

module.exports = { 
  validateApiKey, 
  requireScope, 
  requireAnyScope,
  hasScope,
  addApiKey 
};
