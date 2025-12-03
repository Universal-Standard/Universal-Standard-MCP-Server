const logger = require('../utils/logger');
const { storage } = require('../../server/storage');
const { getKeyPrefix } = require('../utils/encryption');

const CACHE_TTL = 60000;
const MAX_CACHE_SIZE = 1000;
const DEMO_API_KEY = 'demo-api-key';

const VALID_SCOPES = [
  'tools:read',
  'tools:execute',
  'prompts:read',
  'prompts:write',
  'resources:read',
  'resources:write',
  'sampling:create',
  'settings:read',
  'settings:write',
  'admin:*'
];

const DEMO_KEY_DATA = {
  id: 0,
  name: 'Demo User',
  scopes: ['tools:read', 'tools:execute', 'prompts:read', 'resources:read', 'sampling:create', 'settings:read', 'settings:write'],
  rateLimit: 100,
  cachedAt: Date.now()
};

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    if (this.accessOrder.length >= this.maxSize) {
      const lru = this.accessOrder.shift();
      this.cache.delete(lru);
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  deleteByValue(predicate) {
    const keysToDelete = [];
    for (const [key, value] of this.cache.entries()) {
      if (predicate(value)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.delete(key));
  }
}

const memoryCache = new LRUCache(MAX_CACHE_SIZE);

function validateScopes(scopes) {
  if (!Array.isArray(scopes)) {
    throw new Error('Scopes must be an array');
  }

  for (const scope of scopes) {
    if (!VALID_SCOPES.includes(scope)) {
      throw new Error(`Invalid scope: ${scope}. Valid scopes: ${VALID_SCOPES.join(', ')}`);
    }
  }

  return true;
}

function validateRateLimit(limit) {
  if (typeof limit !== 'number' || limit < 1 || limit > 10000) {
    throw new Error('Rate limit must be a number between 1 and 10000');
  }
  return true;
}

/**
 * Validate and normalize API key input data
 * @param {Object} data - Input data
 * @throws {Error} If validation fails
 * @returns {Object} Validated data
 */
function validateApiKeyData(data) {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('name: Must be a non-empty string');
  } else if (data.name.length > 255) {
    errors.push('name: Must be 255 characters or less');
  }

  if (data.scopes) {
    try {
      validateScopes(data.scopes);
    } catch (e) {
      errors.push(`scopes: ${e.message}`);
    }
  }

  if (data.rateLimit) {
    try {
      validateRateLimit(data.rateLimit);
    } catch (e) {
      errors.push(`rateLimit: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  return {
    name: data.name.trim(),
    scopes: data.scopes || ['tools:read', 'prompts:read', 'resources:read'],
    rateLimit: data.rateLimit || 100
  };
}

/**
 * Validate an API key against database or cache
 * @param {string} apiKey - API key to validate
 * @returns {Promise<Object|null>} Key data if valid, null otherwise
 */
async function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return null;
  }

  if (apiKey === DEMO_API_KEY) {
    return { ...DEMO_KEY_DATA };
  }

  const cached = memoryCache.get(apiKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }

  try {
    const dbKey = await storage.getApiKeyByKey(apiKey);
    if (!dbKey) {
      return null;
    }

    if (!dbKey.isActive) {
      logger.debug('Attempted use of inactive API key', { keyId: dbKey.id });
      return null;
    }

    const keyData = {
      id: dbKey.id,
      name: dbKey.name,
      scopes: dbKey.scopes || [],
      rateLimit: dbKey.rateLimit || 100,
      cachedAt: Date.now()
    };

    memoryCache.set(apiKey, keyData);

    storage.updateApiKeyLastUsed(dbKey.id).catch(err => {
      logger.warn('Failed to update API key last used timestamp', { keyId: dbKey.id, error: err.message });
    });

    return keyData;
  } catch (error) {
    logger.error('Error validating API key from database', { error: error.message, stack: error.stack });
    return null;
  }
}

/**
 * Create a new API key
 * @param {Object} data - API key data
 * @returns {Promise<Object>} Created API key
 * @throws {Error} If creation fails
 */
async function addApiKey(data) {
  try {
    const validatedData = validateApiKeyData(data);

    const apiKey = await storage.createApiKey(validatedData);

    logger.info('API key created successfully', {
      keyId: apiKey.id,
      name: validatedData.name,
      scopes: validatedData.scopes.length
    });

    return apiKey;
  } catch (error) {
    logger.error('Failed to create API key', { error: error.message });
    throw error;
  }
}

/**
 * Remove/deactivate an API key
 * @param {number} id - API key ID
 * @returns {Promise<boolean>} True if successful
 * @throws {Error} If operation fails
 */
async function removeApiKey(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new Error('Invalid API key ID');
  }

  try {
    const result = await storage.deleteApiKey(id);
    if (result) {
      logger.info('API key deactivated', { keyId: id });
      memoryCache.deleteByValue(value => value.id === id);
    }
    return result;
  } catch (error) {
    logger.error('Failed to remove API key', { keyId: id, error: error.message });
    throw error;
  }
}

/**
 * List all API keys (with masked key values)
 * @returns {Promise<Array>} List of API keys
 */
async function listApiKeys() {
  try {
    const keys = await storage.getApiKeys();

    return keys.map(k => ({
      id: k.id,
      keyPrefix: getKeyPrefix(k.key),
      name: k.name,
      scopes: k.scopes || [],
      rateLimit: k.rateLimit || 100,
      isActive: k.isActive !== false,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));
  } catch (error) {
    logger.error('Failed to list API keys', { error: error.message });
    throw error;
  }
}

/**
 * Update an existing API key
 * @param {number} id - API key ID
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated API key
 * @throws {Error} If update fails
 */
async function updateApiKey(id, data) {
  if (typeof id !== 'number' || id < 1) {
    throw new Error('Invalid API key ID');
  }

  try {
    const validatedData = validateApiKeyData(data);

    const apiKey = await storage.updateApiKey(id, validatedData);

    logger.info('API key updated successfully', { keyId: id });
    memoryCache.deleteByValue(value => value.id === id);

    return apiKey;
  } catch (error) {
    logger.error('Failed to update API key', { keyId: id, error: error.message });
    throw error;
  }
}

/**
 * Clear the API key cache (useful for testing and admin operations)
 */
function clearCache() {
  memoryCache.clear();
  logger.info('API key cache cleared');
}

/**
 * Get cache statistics for monitoring
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  return {
    size: memoryCache.cache.size,
    maxSize: memoryCache.maxSize,
    utilization: Math.round((memoryCache.cache.size / memoryCache.maxSize) * 100)
  };
}

module.exports = {
  validateApiKey,
  addApiKey,
  removeApiKey,
  listApiKeys,
  updateApiKey,
  clearCache,
  getCacheStats,
  VALID_SCOPES
};
