const logger = require('../utils/logger');

const apiKeys = new Map();

apiKeys.set('demo-api-key', { 
  name: 'Demo User', 
  scopes: ['tools:read', 'tools:execute', 'prompts:read', 'resources:read', 'sampling'],
  rateLimit: 100 
});

function validateApiKey(apiKey) {
  return apiKeys.get(apiKey);
}

function addApiKey(key, data) {
  apiKeys.set(key, data);
  logger.info('API key added', { name: data.name });
}

function removeApiKey(key) {
  const result = apiKeys.delete(key);
  if (result) {
    logger.info('API key removed');
  }
  return result;
}

function listApiKeys() {
  return Array.from(apiKeys.entries()).map(([key, data]) => ({
    keyPrefix: key.substring(0, 8) + '...',
    name: data.name,
    scopes: data.scopes,
  }));
}

module.exports = { validateApiKey, addApiKey, removeApiKey, listApiKeys };
