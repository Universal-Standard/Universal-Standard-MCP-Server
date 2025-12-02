const express = require('express');
const { requireScope } = require('../middleware/auth');
const { providerManager } = require('../providers');
const { listApiKeys, addApiKey, removeApiKey, updateApiKey } = require('../middleware/apiKeys');
const { storage } = require('../../server/storage');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/providers', requireScope('settings:read'), async (req, res) => {
  try {
    const providers = providerManager.listProviders();
    const dbSettings = await storage.getProviderSettings();
    
    const enrichedProviders = providers.map(p => {
      const dbSetting = dbSettings.find(s => s.provider === p.name);
      return {
        ...p,
        defaultModel: dbSetting?.defaultModel || p.defaultModel || 'unknown',
        isEnabled: dbSetting?.isEnabled ?? true,
        hasCustomKey: !!dbSetting?.apiKey
      };
    });
    
    res.json({
      providers: enrichedProviders,
      count: enrichedProviders.length
    });
  } catch (error) {
    logger.error('Failed to get providers', { error: error.message });
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

router.get('/providers/:name', requireScope('settings:read'), async (req, res) => {
  const { name } = req.params;
  const providers = providerManager.listProviders();
  const provider = providers.find(p => p.name.toLowerCase() === name.toLowerCase());
  
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  try {
    const dbSetting = await storage.getProviderSetting(name.toLowerCase());
    res.json({
      ...provider,
      defaultModel: dbSetting?.defaultModel || provider.defaultModel,
      isEnabled: dbSetting?.isEnabled ?? true,
      hasCustomKey: !!dbSetting?.apiKey
    });
  } catch (error) {
    res.json(provider);
  }
});

router.put('/providers/:name', requireScope('settings:write'), async (req, res) => {
  const { name } = req.params;
  const { apiKey, defaultModel, isEnabled } = req.body;
  
  try {
    const setting = await storage.upsertProviderSetting(name.toLowerCase(), {
      apiKey: apiKey || null,
      defaultModel: defaultModel || null,
      isEnabled: isEnabled !== false
    });
    
    await storage.logActivity('settings', 'provider_updated', { provider: name }, null, req.ip);
    
    logger.info('Provider settings updated', { provider: name });
    
    res.json({
      success: true,
      provider: name,
      defaultModel: setting.defaultModel,
      isEnabled: setting.isEnabled,
      hasCustomKey: !!setting.apiKey
    });
  } catch (error) {
    logger.error('Failed to update provider', { provider: name, error: error.message });
    res.status(500).json({ error: 'Failed to update provider settings' });
  }
});

router.post('/providers/:name/test', requireScope('settings:write'), async (req, res) => {
  const { name } = req.params;
  
  try {
    const result = await providerManager.chat(
      [{ role: 'user', content: 'Say "Connection successful!" in exactly those words.' }],
      { provider: name }
    );
    
    await storage.logActivity('test', 'provider_test_success', { provider: name, model: result.model }, null, req.ip);
    
    res.json({
      success: true,
      provider: name,
      response: result.content,
      model: result.model
    });
  } catch (error) {
    logger.error('Provider test failed', { provider: name, error: error.message });
    
    await storage.logActivity('test', 'provider_test_failed', { provider: name, error: error.message }, null, req.ip).catch(() => {});
    
    res.status(error.statusCode || 500).json({
      success: false,
      provider: name,
      error: error.message
    });
  }
});

router.get('/server', requireScope('settings:read'), async (req, res) => {
  try {
    const dbSettings = await storage.getServerSettings();
    
    res.json({
      name: 'SPURS MCP Server',
      version: '1.0.0',
      protocol: 'MCP 2024-11-05',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      settings: {
        rateLimit: dbSettings.rateLimit || { enabled: true, windowMs: 60000, max: 100 },
        security: dbSettings.security || { requireApiKey: true, enableHelmet: true, corsOrigins: '*' }
      }
    });
  } catch (error) {
    res.json({
      name: 'SPURS MCP Server',
      version: '1.0.0',
      protocol: 'MCP 2024-11-05',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      settings: {
        rateLimit: { enabled: true, windowMs: 60000, max: 100 },
        security: { requireApiKey: true, enableHelmet: true, corsOrigins: '*' }
      }
    });
  }
});

router.patch('/server', requireScope('settings:write'), async (req, res) => {
  const { rateLimit, security } = req.body;
  
  try {
    if (rateLimit) {
      await storage.setServerSetting('rateLimit', rateLimit);
    }
    
    if (security) {
      await storage.setServerSetting('security', security);
    }
    
    const settings = await storage.getServerSettings();
    
    await storage.logActivity('settings', 'server_settings_updated', { rateLimit, security }, null, req.ip);
    
    logger.info('Server settings updated', { settings });
    
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    logger.error('Failed to update server settings', { error: error.message });
    res.status(500).json({ error: 'Failed to update settings' });
  }
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

router.get('/api-keys', requireScope('settings:read'), async (req, res) => {
  try {
    const keys = await listApiKeys();
    res.json({ apiKeys: keys, count: keys.length });
  } catch (error) {
    logger.error('Failed to list API keys', { error: error.message });
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

router.post('/api-keys', requireScope('settings:write'), async (req, res) => {
  const { name, scopes, rateLimit } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  try {
    const apiKey = await addApiKey({
      name: name.trim(),
      scopes: scopes || ['tools:read', 'tools:execute', 'prompts:read', 'resources:read', 'sampling'],
      rateLimit: rateLimit || 100
    });
    
    await storage.logActivity('api_key', 'created', { name: apiKey.name, id: apiKey.id }, null, req.ip);
    
    res.status(201).json({
      success: true,
      apiKey: {
        id: apiKey.id,
        key: apiKey.key,
        name: apiKey.name,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        createdAt: apiKey.createdAt
      },
      message: 'API key created. Save this key securely - it won\'t be shown again!'
    });
  } catch (error) {
    logger.error('Failed to create API key', { error: error.message });
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

router.put('/api-keys/:id', requireScope('settings:write'), async (req, res) => {
  const { id } = req.params;
  const { name, scopes, rateLimit } = req.body;
  
  try {
    const apiKey = await updateApiKey(parseInt(id), {
      name,
      scopes,
      rateLimit
    });
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    await storage.logActivity('api_key', 'updated', { id: parseInt(id) }, null, req.ip);
    
    res.json({
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit
      }
    });
  } catch (error) {
    logger.error('Failed to update API key', { error: error.message });
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

router.delete('/api-keys/:id', requireScope('settings:write'), async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await removeApiKey(parseInt(id));
    
    if (!result) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    await storage.logActivity('api_key', 'deleted', { id: parseInt(id) }, null, req.ip);
    
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    logger.error('Failed to delete API key', { error: error.message });
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

router.get('/activity', requireScope('settings:read'), async (req, res) => {
  const { limit = 100, offset = 0, type } = req.query;
  
  try {
    const logs = await storage.getActivityLogs(parseInt(limit), parseInt(offset), type || null);
    res.json({ logs, count: logs.length });
  } catch (error) {
    logger.error('Failed to get activity logs', { error: error.message });
    res.status(500).json({ error: 'Failed to get activity logs' });
  }
});

router.post('/chat/message', requireScope('sampling'), async (req, res) => {
  const { sessionId, provider, model, role, content, metadata } = req.body;
  
  if (!sessionId || !provider || !role || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const message = await storage.saveChatMessage(sessionId, provider, model, role, content, metadata);
    res.status(201).json({ success: true, message });
  } catch (error) {
    logger.error('Failed to save chat message', { error: error.message });
    res.status(500).json({ error: 'Failed to save message' });
  }
});

router.get('/chat/history/:sessionId', requireScope('settings:read'), async (req, res) => {
  const { sessionId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const messages = await storage.getChatHistory(sessionId, parseInt(limit));
    res.json({ messages, count: messages.length });
  } catch (error) {
    logger.error('Failed to get chat history', { error: error.message });
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

router.get('/chat/sessions', requireScope('settings:read'), async (req, res) => {
  const { limit = 20 } = req.query;
  
  try {
    const sessions = await storage.getChatSessions(parseInt(limit));
    res.json({ sessions, count: sessions.length });
  } catch (error) {
    logger.error('Failed to get chat sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

module.exports = router;
