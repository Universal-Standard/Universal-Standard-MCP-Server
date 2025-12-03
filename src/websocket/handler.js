const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const url = require('url');
const { registry } = require('../mcp/toolRegistry');
const { promptRegistry } = require('../mcp/promptRegistry');
const { resourceRegistry } = require('../mcp/resourceRegistry');
const { providerManager } = require('../providers');
const { validateApiKey } = require('../middleware/apiKeys');
const logger = require('../utils/logger');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });
  
  server.on('upgrade', async (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    
    if (pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      logger.warn('WebSocket connection rejected: No API key in header', { ip: socket.remoteAddress });
      socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nAPI key required in X-API-Key header');
      socket.destroy();
      return;
    }
    
    try {
      const keyData = await validateApiKey(apiKey);
      if (!keyData) {
        logger.warn('WebSocket connection rejected: Invalid API key', { ip: socket.remoteAddress });
        socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nInvalid API key');
        socket.destroy();
        return;
      }
      
      request.apiKeyData = keyData;
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      logger.error('WebSocket auth error', { error: error.message });
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });
  
  wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    logger.info('WebSocket client connected', { clientId, user: req.apiKeyData?.name });
    
    ws.clientId = clientId;
    ws.isAlive = true;
    ws.apiKeyData = req.apiKeyData;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'connected',
      params: {
        clientId,
        serverInfo: {
          name: 'SPURS MCP Server',
          version: '1.0.0',
        },
        authenticated: true,
        user: req.apiKeyData?.name,
      },
    }));
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        logger.error('WebSocket message error', { clientId, error: error.message });
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
          id: null,
        }));
      }
    });
    
    ws.on('close', () => {
      logger.info('WebSocket client disconnected', { clientId });
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
    });
  });
  
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  return wss;
}

function hasScope(ws, scope) {
  return ws.apiKeyData && ws.apiKeyData.scopes.includes(scope);
}

async function handleMessage(ws, message) {
  const { jsonrpc, method, params, id } = message;
  
  if (jsonrpc !== '2.0') {
    return sendError(ws, id, -32600, 'Invalid Request');
  }
  
  try {
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            prompts: { listChanged: true },
            resources: { subscribe: false, listChanged: true },
          },
          serverInfo: {
            name: 'SPURS MCP Server',
            version: '1.0.0',
          },
        };
        break;
        
      case 'tools/list':
        if (!hasScope(ws, 'tools:read')) {
          return sendError(ws, id, -32603, 'Permission denied: tools:read scope required');
        }
        result = { tools: registry.list() };
        break;
        
      case 'tools/call':
        if (!hasScope(ws, 'tools:execute')) {
          return sendError(ws, id, -32603, 'Permission denied: tools:execute scope required');
        }
        if (!params?.name) {
          return sendError(ws, id, -32602, 'Invalid params: tool name required');
        }
        const tool = registry.get(params.name);
        if (!tool) {
          return sendError(ws, id, -32602, `Tool not found: ${params.name}`);
        }
        result = await registry.execute(params.name, params.arguments || {});
        break;
        
      case 'prompts/list':
        if (!hasScope(ws, 'prompts:read')) {
          return sendError(ws, id, -32603, 'Permission denied: prompts:read scope required');
        }
        result = { prompts: promptRegistry.list() };
        break;
        
      case 'prompts/get':
        if (!hasScope(ws, 'prompts:read')) {
          return sendError(ws, id, -32603, 'Permission denied: prompts:read scope required');
        }
        if (!params?.name) {
          return sendError(ws, id, -32602, 'Invalid params: prompt name required');
        }
        const prompt = promptRegistry.get(params.name);
        if (!prompt) {
          return sendError(ws, id, -32602, `Prompt not found: ${params.name}`);
        }
        result = promptRegistry.render(params.name, params.arguments || {});
        break;
        
      case 'resources/list':
        if (!hasScope(ws, 'resources:read')) {
          return sendError(ws, id, -32603, 'Permission denied: resources:read scope required');
        }
        result = { resources: resourceRegistry.list() };
        break;
        
      case 'resources/read':
        if (!hasScope(ws, 'resources:read')) {
          return sendError(ws, id, -32603, 'Permission denied: resources:read scope required');
        }
        if (!params?.uri) {
          return sendError(ws, id, -32602, 'Invalid params: resource URI required');
        }
        const resource = resourceRegistry.get(params.uri);
        if (!resource) {
          return sendError(ws, id, -32602, `Resource not found: ${params.uri}`);
        }
        result = await resourceRegistry.read(params.uri);
        break;
        
      case 'sampling/createMessage':
        if (!hasScope(ws, 'sampling')) {
          return sendError(ws, id, -32603, 'Permission denied: sampling scope required');
        }
        try {
          result = await handleSampling(ws, params);
        } catch (error) {
          let errorCode = -32603;
          if (error.statusCode === 400 || error.statusCode === 422) {
            errorCode = -32602;
          } else if (error.statusCode === 401 || error.statusCode === 403) {
            errorCode = -32603;
          } else if (error.statusCode === 429) {
            errorCode = -32001;
          } else if (error.statusCode === 503 || error.statusCode === 502 || error.statusCode === 504) {
            errorCode = -32002;
          }
          return sendError(ws, id, errorCode, error.message, {
            provider: error.providerName || params?.provider,
            statusCode: error.statusCode
          });
        }
        break;
      
      case 'providers/list':
        result = { providers: providerManager.listProviders() };
        break;
        
      case 'ping':
        result = {};
        break;
        
      default:
        return sendError(ws, id, -32601, `Method not found: ${method}`);
    }
    
    sendResult(ws, id, result);
  } catch (error) {
    logger.error('Method execution error', { method, error: error.message });
    sendError(ws, id, -32603, error.message);
  }
}

async function handleSampling(ws, params) {
  const { messages, modelPreferences, maxTokens, provider: providerName } = params;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    const error = new Error('Invalid params: messages array required');
    error.statusCode = 400;
    throw error;
  }
  
  const selectedProvider = providerName || 
    modelPreferences?.hints?.[0]?.provider || 
    'openai';
  
  const model = modelPreferences?.hints?.[0]?.name;
  
  const formattedMessages = messages.map(m => ({
    role: m.role,
    content: m.content?.text || m.content,
  }));
  
  if (params.stream) {
    const streamId = uuidv4();
    
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'sampling/progress',
      params: { streamId, status: 'started', provider: selectedProvider },
    }));
    
    try {
      for await (const chunk of providerManager.chatStream(formattedMessages, { 
        provider: selectedProvider, 
        model,
        maxTokens 
      })) {
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'sampling/chunk',
          params: { streamId, content: chunk },
        }));
      }
      
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'sampling/progress',
        params: { streamId, status: 'completed' },
      }));
      
      return { streamId, status: 'completed' };
    } catch (error) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'sampling/progress',
        params: { streamId, status: 'error', error: error.message },
      }));
      throw error;
    }
  }
  
  const response = await providerManager.chat(formattedMessages, { 
    provider: selectedProvider, 
    model,
    maxTokens 
  });
  
  return {
    role: 'assistant',
    content: { type: 'text', text: response.content },
    model: response.model,
    provider: selectedProvider,
    stopReason: 'endTurn',
  };
}

function sendResult(ws, id, result) {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    result,
    id,
  }));
}

function sendError(ws, id, code, message, metadata = {}) {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    error: { 
      code, 
      message,
      data: Object.keys(metadata).length > 0 ? metadata : undefined
    },
    id,
  }));
}

module.exports = { setupWebSocket };
