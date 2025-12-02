const express = require('express');
const { requireScope } = require('../middleware/auth');
const { providerManager } = require('../providers');
const logger = require('../utils/logger');

const router = express.Router();

const serverSettings = {
  rateLimit: {
    enabled: true,
    windowMs: 60000,
    max: 100
  },
  security: {
    requireApiKey: true,
    enableHelmet: true,
    corsOrigins: '*'
  }
};

router.get('/providers', requireScope('settings:read'), (req, res) => {
  const providers = providerManager.listProviders();
  res.json({
    providers,
    count: providers.length
  });
});

router.get('/providers/:name', requireScope('settings:read'), (req, res) => {
  const { name } = req.params;
  const providers = providerManager.listProviders();
  const provider = providers.find(p => p.name.toLowerCase() === name.toLowerCase());
  
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  res.json(provider);
});

router.post('/providers/:name/test', requireScope('settings:write'), async (req, res) => {
  const { name } = req.params;
  
  try {
    const result = await providerManager.chat(
      [{ role: 'user', content: 'Say "Connection successful!" in exactly those words.' }],
      { provider: name }
    );
    
    res.json({
      success: true,
      provider: name,
      response: result.content,
      model: result.model
    });
  } catch (error) {
    logger.error('Provider test failed', { provider: name, error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      provider: name,
      error: error.message
    });
  }
});

router.get('/server', requireScope('settings:read'), (req, res) => {
  res.json({
    name: 'US-SPURS Advanced MCP Server',
    version: '1.0.0',
    protocol: 'MCP 2024-11-05',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    settings: serverSettings
  });
});

router.patch('/server', requireScope('settings:write'), (req, res) => {
  const { rateLimit, security } = req.body;
  
  if (rateLimit) {
    Object.assign(serverSettings.rateLimit, rateLimit);
  }
  
  if (security) {
    Object.assign(serverSettings.security, security);
  }
  
  logger.info('Server settings updated', { settings: serverSettings });
  
  res.json({
    success: true,
    settings: serverSettings
  });
});

router.get('/stats', requireScope('settings:read'), async (req, res) => {
  const { registry } = require('../mcp/toolRegistry');
  const { promptRegistry } = require('../mcp/promptRegistry');
  const { resourceRegistry } = require('../mcp/resourceRegistry');
  
  res.json({
    tools: registry.list().length,
    prompts: promptRegistry.list().length,
    resources: resourceRegistry.list().length,
    providers: providerManager.listProviders().length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
