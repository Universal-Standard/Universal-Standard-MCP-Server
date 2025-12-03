/**
 * WebSocket Handler
 * MCP protocol support over WebSocket transport
 */
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const url = require('url');
const { registry } = require('../mcp/toolRegistry');
const { promptRegistry } = require('../mcp/promptRegistry');
const { resourceRegistry } = require('../mcp/resourceRegistry');
const { providerManager } = require('../providers');
const { validateApiKey } = require('../middleware/apiKeys');
const logger = require('../utils/logger');

const PING_INTERVAL = 30000;
const SERVER_INFO = {
  name: 'SPURS MCP Server',
  version: '1.0.0',
};
const PROTOCOL_VERSION = '2024-11-05';
const WEBSOCKET_PATH = '/ws';

/**
 * JSON-RPC 2.0 error codes
 */
const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  RATE_LIMITED: -32001,
  SERVICE_UNAVAILABLE: -32002,
};

/**
 * Setup WebSocket server for MCP protocol
 * @param {http.Server} server - HTTP server instance
 * @returns {WebSocket.Server} WebSocket server instance
 */
function setupWebSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });
  
  server.on('upgrade', async (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    
    if (pathname !== WEBSOCKET_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      logger.warn('WebSocket connection rejected: No API key in header', { 
        ip: socket.remoteAddress 
      });
      socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nAPI key required in X-API-Key header');
      socket.destroy();
      return;
    }
    
    try {
      const keyData = await validateApiKey(apiKey);
      if (!keyData) {
        logger.warn('WebSocket connection rejected: Invalid API key', { 
          ip: socket.remoteAddress 
        });
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
    const userName = req.apiKeyData?.name || 'unknown';
    
    logger.info('WebSocket client connected', { clientId, user: userName });
    
    ws.clientId = clientId;
    ws.isAlive = true;
    ws.apiKeyData = req.apiKeyData;
    ws.connectedAt = Date.now();
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    safeSend(ws, {
      jsonrpc: '2.0',
      method: 'connected',
      params: {
        clientId,
        serverInfo: SERVER_INFO,
        authenticated: true,
        user: userName,
      },
    });
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        logger.error('WebSocket message error', { clientId, error: error.message });
        safeSend(ws, {
          jsonrpc: '2.0',
          error: { code: ERROR_CODES.PARSE_ERROR, message: 'Parse error' },
          id: null,
        });
      }
    });
    
    ws.on('close', (code, reason) => {
      const duration = Date.now() - ws.connectedAt;
      logger.info('WebSocket client disconnected', { 
        clientId, 
        code, 
        duration: `${duration}ms` 
      });
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
    });
  });
  
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        logger.debug('Terminating inactive WebSocket client', { clientId: ws.clientId });
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_INTERVAL);
  
  wss.on('close', () => {
    clearInterval(interval);
    logger.info('WebSocket server closed');
  });
  
  return wss;
}

/**
 * Safely send data through WebSocket
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} data - Data to send
 */
function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch (error) {
      logger.error('WebSocket send error', { 
        clientId: ws.clientId, 
        error: error.message 
      });
    }
  }
}

/**
 * Check if WebSocket client has required scope
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} scope - Required scope
 * @returns {boolean}
 */
function hasScope(ws, scope) {
  if (!ws.apiKeyData || !ws.apiKeyData.scopes) return false;
  
  if (ws.apiKeyData.scopes.includes('admin:*')) return true;
  
  return ws.apiKeyData.scopes.includes(scope);
}

/**
 * Handle incoming WebSocket message
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - JSON-RPC 2.0 message
 */
async function handleMessage(ws, message) {
  const { jsonrpc, method, params, id } = message;
  
  if (jsonrpc !== '2.0') {
    return sendError(ws, id, ERROR_CODES.INVALID_REQUEST, 'Invalid Request');
  }
  
  const startTime = Date.now();
  
  try {
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: true },
            prompts: { listChanged: true },
            resources: { subscribe: false, listChanged: true },
          },
          serverInfo: SERVER_INFO,
        };
        break;
        
      case 'tools/list':
        if (!hasScope(ws, 'tools:read')) {
          return sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, 'Permission denied: tools:read scope required');
        }
        result = { tools: registry.list() };
        break;
        
      case 'tools/call':
        if (!hasScope(ws, 'tools:execute')) {
          return sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, 'Permission denied: tools:execute scope required');
        }
        if (!params?.name) {
          return sendError(ws, id, ERROR_CODES.INVALID_PARAMS, 'Invalid params: tool name required');
        }
        const tool = registry.get(params.name);
        if (!tool) {
          return sendError(ws, id, ERROR_CODES.INVALID_PARAMS, `Tool not found: ${params.name}`);
        }
        result = await registry.execute(params.name, params.arguments || {});
        break;
        
      case 'prompts/list':
        if (!hasScope(ws, 'prompts:read')) {
          return sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, 'Permission denied: prompts:read scope required');
        }
        result = { prompts: promptRegistry.list() };
        break;
        
      case 'prompts/get':
        if (!hasScope(ws, 'prompts:read')) {
          return sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, 'Permission denied: prompts:read scope required');
        }
        if (!params?.name) {
          return sendError(ws, id, ERROR_CODES.INVALID_PARAMS, 'Invalid params: prompt name required');
        }
        const prompt = promptRegistry.get(params.name);
        if (!prompt) {
          return sendError(ws, id, ERROR_CODES.INVALID_PARAMS, `Prompt not found: ${params.name}`);
        }
        result = promptRegistry.render(params.name, params.arguments || {});
        break;
        
      case 'resources/list':
        if (!hasScope(ws, 'resources:read')) {
          return sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, 'Permission denied: resources:read scope required');
        }
        result = { resources: resourceRegistry.list() };
        break;
        
      case 'resources/read':
        if (!hasScope(ws, 'resources:read')) {
          return sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, 'Permission denied: resources:read scope required');
        }
        if (!params?.uri) {
          return sendError(ws, id, ERROR_CODES.INVALID_PARAMS, 'Invalid params: resource URI required');
        }
        const resource = resourceRegistry.get(params.uri);
        if (!resource) {
          return sendError(ws, id, ERROR_CODES.INVALID_PARAMS, `Resource not found: ${params.uri}`);
        }
        result = await resourceRegistry.read(params.uri);
        break;
        
      case 'sampling/createMessage':
        if (!hasScope(ws, 'sampling:create') && !hasScope(ws, 'sampling')) {
          return sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, 'Permission denied: sampling:create scope required');
        }
        try {
          result = await handleSampling(ws, params);
        } catch (error) {
          const errorCode = mapHttpStatusToRpcError(error.statusCode);
          return sendError(ws, id, errorCode, error.message, {
            provider: error.providerName || params?.provider,
            statusCode: error.statusCode,
          });
        }
        break;
      
      case 'providers/list':
        result = { providers: providerManager.listProviders() };
        break;
        
      case 'ping':
        result = { timestamp: Date.now() };
        break;
        
      default:
        return sendError(ws, id, ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
    
    const duration = Date.now() - startTime;
    logger.debug('WebSocket method executed', { method, duration: `${duration}ms` });
    
    sendResult(ws, id, result);
  } catch (error) {
    logger.error('Method execution error', { 
      method, 
      error: error.message,
      clientId: ws.clientId,
    });
    sendError(ws, id, ERROR_CODES.INTERNAL_ERROR, error.message);
  }
}

/**
 * Map HTTP status code to JSON-RPC error code
 * @param {number} statusCode - HTTP status code
 * @returns {number} JSON-RPC error code
 */
function mapHttpStatusToRpcError(statusCode) {
  if (statusCode === 400 || statusCode === 422) return ERROR_CODES.INVALID_PARAMS;
  if (statusCode === 401 || statusCode === 403) return ERROR_CODES.INTERNAL_ERROR;
  if (statusCode === 429) return ERROR_CODES.RATE_LIMITED;
  if (statusCode === 502 || statusCode === 503 || statusCode === 504) return ERROR_CODES.SERVICE_UNAVAILABLE;
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Handle sampling/createMessage request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} params - Sampling parameters
 * @returns {Promise<Object>} Sampling result
 */
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
    return handleStreamingSampling(ws, formattedMessages, selectedProvider, model, maxTokens);
  }
  
  const response = await providerManager.chat(formattedMessages, { 
    provider: selectedProvider, 
    model,
    maxTokens,
  });
  
  return {
    role: 'assistant',
    content: { type: 'text', text: response.content },
    model: response.model,
    provider: selectedProvider,
    stopReason: 'endTurn',
  };
}

/**
 * Handle streaming sampling request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Array} messages - Formatted messages
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {number} maxTokens - Max tokens
 * @returns {Promise<Object>} Stream result
 */
async function handleStreamingSampling(ws, messages, provider, model, maxTokens) {
  const streamId = uuidv4();
  
  safeSend(ws, {
    jsonrpc: '2.0',
    method: 'sampling/progress',
    params: { streamId, status: 'started', provider },
  });
  
  try {
    for await (const chunk of providerManager.chatStream(messages, { 
      provider, 
      model,
      maxTokens,
    })) {
      safeSend(ws, {
        jsonrpc: '2.0',
        method: 'sampling/chunk',
        params: { streamId, content: chunk },
      });
    }
    
    safeSend(ws, {
      jsonrpc: '2.0',
      method: 'sampling/progress',
      params: { streamId, status: 'completed' },
    });
    
    return { streamId, status: 'completed' };
  } catch (error) {
    safeSend(ws, {
      jsonrpc: '2.0',
      method: 'sampling/progress',
      params: { streamId, status: 'error', error: error.message },
    });
    throw error;
  }
}

/**
 * Send JSON-RPC 2.0 result
 * @param {WebSocket} ws - WebSocket connection
 * @param {string|number} id - Request ID
 * @param {*} result - Result data
 */
function sendResult(ws, id, result) {
  if (ws.readyState !== WebSocket.OPEN) {
    logger.warn('Cannot send result: WebSocket not open', { clientId: ws.clientId });
    return;
  }
  safeSend(ws, {
    jsonrpc: '2.0',
    result,
    id,
  });
}

/**
 * Send JSON-RPC 2.0 error
 * @param {WebSocket} ws - WebSocket connection
 * @param {string|number} id - Request ID
 * @param {number} code - Error code
 * @param {string} message - Error message
 * @param {Object} metadata - Additional error data
 */
function sendError(ws, id, code, message, metadata = {}) {
  if (ws.readyState !== WebSocket.OPEN) {
    logger.warn('Cannot send error: WebSocket not open', { clientId: ws.clientId });
    return;
  }
  safeSend(ws, {
    jsonrpc: '2.0',
    error: { 
      code, 
      message,
      data: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
    id,
  });
}

module.exports = { 
  setupWebSocket,
  ERROR_CODES,
  PROTOCOL_VERSION,
};
