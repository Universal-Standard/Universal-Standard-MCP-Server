const express = require('express');
const { registry } = require('../mcp/toolRegistry');
const { promptRegistry } = require('../mcp/promptRegistry');
const { resourceRegistry } = require('../mcp/resourceRegistry');
const { requireScope } = require('../middleware/auth');
const logger = require('../utils/logger');
const { webhookManager } = require('../utils/webhooks');

const router = express.Router();

router.get('/tools', requireScope('tools:read'), (req, res) => {
  const tools = registry.list();
  res.json({
    tools,
    count: tools.length,
  });
});

router.get('/tools/:name', requireScope('tools:read'), (req, res) => {
  const tool = registry.get(req.params.name);
  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }
  
  res.json({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    category: tool.category,
  });
});

router.post('/tools/call', requireScope('tools:execute'), async (req, res) => {
  const { name, arguments: args, autoEvolve = false } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Tool name is required' });
  }
  
  try {
    const result = await registry.execute(name, args || {}, {
      user: req.apiKeyData,
      requestId: req.headers['x-request-id'],
      description: req.body.description,
      autoEvolve
    });
    
    if (result._evolution?.newTool) {
      logger.info('Auto-evolved new tool', { 
        name, 
        evolutionId: result._evolution.evolutionId,
        duration: result._evolution.duration 
      });
      
      webhookManager.trigger('tool.created', {
        toolName: name,
        evolutionId: result._evolution.evolutionId,
        duration: result._evolution.duration
      });
    }
    
    webhookManager.trigger('tool.executed', {
      toolName: name,
      success: true,
      hasEvolution: !!result._evolution?.newTool
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Tool call failed', { name, error: error.message, statusCode: error.statusCode });
    
    webhookManager.trigger('tool.failed', {
      toolName: name,
      error: error.message
    });
    
    const statusCode = error.statusCode || 
      (error.message.includes('Invalid') || error.message.includes('required') || error.message.includes('Missing') ? 400 : 500);
    
    res.status(statusCode).json({
      error: error.message,
      statusCode,
      isError: true,
    });
  }
});

router.get('/tools/stats', requireScope('tools:read'), (req, res) => {
  const stats = registry.getStats();
  res.json(stats);
});

router.get('/prompts', requireScope('prompts:read'), (req, res) => {
  const prompts = promptRegistry.list();
  res.json({
    prompts,
    count: prompts.length,
  });
});

router.get('/prompts/:name', requireScope('prompts:read'), (req, res) => {
  const prompt = promptRegistry.get(req.params.name);
  if (!prompt) {
    return res.status(404).json({ error: 'Prompt not found' });
  }
  
  res.json(prompt);
});

router.post('/prompts/get', requireScope('prompts:read'), (req, res) => {
  const { name, arguments: args } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Prompt name is required' });
  }
  
  try {
    const result = promptRegistry.render(name, args || {});
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/resources', requireScope('resources:read'), (req, res) => {
  const resources = resourceRegistry.list();
  res.json({
    resources,
    count: resources.length,
  });
});

router.post('/resources/read', requireScope('resources:read'), async (req, res) => {
  const { uri } = req.body;
  
  if (!uri) {
    return res.status(400).json({ error: 'Resource URI is required' });
  }
  
  try {
    const result = await resourceRegistry.read(uri, {
      user: req.apiKeyData,
    });
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/capabilities', (req, res) => {
  res.json({
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: { listChanged: true },
      prompts: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      sampling: {},
      logging: {},
    },
    serverInfo: {
      name: 'SPURS MCP Server',
      version: '1.0.0',
    },
  });
});

router.post('/sampling/create', requireScope('sampling'), async (req, res) => {
  const { messages, provider = 'openai', model, max_tokens } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ 
      error: 'Messages array is required',
      statusCode: 400 
    });
  }
  
  const { providerManager } = require('../providers');
  
  try {
    const response = await providerManager.chat(messages, {
      provider,
      model,
      maxTokens: max_tokens,
    });
    
    res.json({
      role: 'assistant',
      content: { type: 'text', text: response.content },
      model: response.model,
      provider,
      usage: response.usage,
    });
  } catch (error) {
    logger.error('Sampling failed', { provider, error: error.message, statusCode: error.statusCode });
    
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message,
      statusCode,
      provider,
      isError: true,
    });
  }
});

module.exports = router;
