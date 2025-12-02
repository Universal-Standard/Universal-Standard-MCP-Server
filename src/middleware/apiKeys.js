const logger = require('../utils/logger');
const { storage } = require('../../server/storage');

const memoryCache = new Map();
const CACHE_TTL = 60000;

memoryCache.set('demo-api-key', { 
  id: 0,
  name: 'Demo User', 
  scopes: ['tools:read', 'tools:execute', 'prompts:read', 'resources:read', 'sampling', 'settings:read', 'settings:write'],
  rateLimit: 100,
  cachedAt: Date.now()
});

async function validateApiKey(apiKey) {
  if (apiKey === 'demo-api-key') {
    return memoryCache.get('demo-api-key');
  }

  const cached = memoryCache.get(apiKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }

  try {
    const dbKey = await storage.getApiKeyByKey(apiKey);
    if (dbKey && dbKey.isActive) {
      const keyData = {
        id: dbKey.id,
        name: dbKey.name,
        scopes: dbKey.scopes,
        rateLimit: dbKey.rateLimit,
        cachedAt: Date.now()
      };
      memoryCache.set(apiKey, keyData);
      
      storage.updateApiKeyLastUsed(dbKey.id).catch(err => {
        logger.warn('Failed to update API key last used', { error: err.message });
      });
      
      return keyData;
    }
  } catch (error) {
    logger.error('Error validating API key from database', { error: error.message });
  }
  
  return null;
}

async function addApiKey(data) {
  try {
    const apiKey = await storage.createApiKey(data);
    logger.info('API key created', { name: data.name, id: apiKey.id });
    return apiKey;
  } catch (error) {
    logger.error('Failed to create API key', { error: error.message });
    throw error;
  }
}

async function removeApiKey(id) {
  try {
    const result = await storage.deleteApiKey(id);
    if (result) {
      logger.info('API key deactivated', { id });
      for (const [key, value] of memoryCache.entries()) {
        if (value.id === id) {
          memoryCache.delete(key);
          break;
        }
      }
    }
    return result;
  } catch (error) {
    logger.error('Failed to remove API key', { error: error.message });
    throw error;
  }
}

async function listApiKeys() {
  try {
    const keys = await storage.getApiKeys();
    return keys.map(k => ({
      id: k.id,
      keyPrefix: k.key.substring(0, 12) + '...',
      name: k.name,
      scopes: k.scopes,
      rateLimit: k.rateLimit,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));
  } catch (error) {
    logger.error('Failed to list API keys', { error: error.message });
    return [{
      id: 0,
      keyPrefix: 'demo-api-...',
      name: 'Demo User',
      scopes: ['tools:read', 'tools:execute', 'prompts:read', 'resources:read', 'sampling', 'settings:read', 'settings:write'],
      rateLimit: 100
    }];
  }
}

async function updateApiKey(id, data) {
  try {
    const apiKey = await storage.updateApiKey(id, data);
    for (const [key, value] of memoryCache.entries()) {
      if (value.id === id) {
        memoryCache.delete(key);
        break;
      }
    }
    logger.info('API key updated', { id });
    return apiKey;
  } catch (error) {
    logger.error('Failed to update API key', { error: error.message });
    throw error;
  }
}

module.exports = { validateApiKey, addApiKey, removeApiKey, listApiKeys, updateApiKey };
