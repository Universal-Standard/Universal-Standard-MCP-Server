require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { validateApiKey } = require('./src/middleware/auth');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { setupWebSocket } = require('./src/websocket/handler');

require('./src/tools');

const mcpRoutes = require('./src/routes/mcp');
const healthRoutes = require('./src/routes/health');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/mcp', limiter);

app.use((req, res, next) => {
  logger.info('Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

app.use('/health', healthRoutes);

app.get('/', (req, res) => {
  const acceptHeader = req.get('Accept') || '';
  
  if (acceptHeader.includes('text/html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>US-SPURS Advanced MCP Server</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 900px;
            width: 100%;
            padding: 40px;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
          }
          h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
          }
          .version {
            color: #666;
            font-size: 1.1em;
          }
          .status {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            margin-top: 10px;
          }
          .section {
            margin-bottom: 35px;
          }
          .section h2 {
            color: #667eea;
            font-size: 1.5em;
            margin-bottom: 15px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
          }
          .endpoints {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
          }
          .endpoint {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          .endpoint-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
          }
          .endpoint-path {
            color: #666;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            word-break: break-all;
          }
          .endpoint-desc {
            color: #888;
            font-size: 0.85em;
            margin-top: 5px;
          }
          .tools {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
          }
          .tool {
            background: #f0f4ff;
            padding: 12px;
            border-radius: 6px;
            border-left: 3px solid #764ba2;
          }
          .tool-name {
            font-weight: bold;
            color: #333;
          }
          .tool-category {
            color: #666;
            font-size: 0.85em;
          }
          .code-block {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            margin-top: 10px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.85em;
          }
          .auth-note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            border-radius: 4px;
            margin-top: 10px;
            color: #333;
          }
          footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 US-SPURS Advanced MCP Server</h1>
            <div class="version">v1.0.0</div>
            <div class="status">✓ Operational</div>
          </div>
          
          <div class="section">
            <h2>📡 Core Endpoints</h2>
            <div class="endpoints">
              <div class="endpoint">
                <div class="endpoint-name">Public Info</div>
                <div class="endpoint-path">GET /</div>
                <div class="endpoint-desc">Server information</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">Health Check</div>
                <div class="endpoint-path">GET /health</div>
                <div class="endpoint-desc">Server status</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">WebSocket</div>
                <div class="endpoint-path">WS /ws</div>
                <div class="endpoint-desc">Real-time streaming</div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>🔧 MCP API Endpoints</h2>
            <div class="auth-note">
              ⚠️ All endpoints require <code>X-API-Key: demo-api-key</code> header
            </div>
            <div class="endpoints">
              <div class="endpoint">
                <div class="endpoint-name">List Tools</div>
                <div class="endpoint-path">GET /mcp/tools</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">Execute Tool</div>
                <div class="endpoint-path">POST /mcp/tools/call</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">List Prompts</div>
                <div class="endpoint-path">GET /mcp/prompts</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">Get Prompt</div>
                <div class="endpoint-path">POST /mcp/prompts/get</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">List Resources</div>
                <div class="endpoint-path">GET /mcp/resources</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">Read Resource</div>
                <div class="endpoint-path">POST /mcp/resources/read</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">AI Sampling</div>
                <div class="endpoint-path">POST /mcp/sampling/create</div>
              </div>
              <div class="endpoint">
                <div class="endpoint-name">Capabilities</div>
                <div class="endpoint-path">GET /mcp/capabilities</div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>🛠️ Built-in Tools</h2>
            <div class="tools">
              <div class="tool"><div class="tool-name">ai_chat</div><div class="tool-category">AI</div></div>
              <div class="tool"><div class="tool-name">ai_summarize</div><div class="tool-category">AI</div></div>
              <div class="tool"><div class="tool-name">web_search</div><div class="tool-category">Search</div></div>
              <div class="tool"><div class="tool-name">code_sandbox</div><div class="tool-category">Code</div></div>
              <div class="tool"><div class="tool-name">ai_providers</div><div class="tool-category">Utility</div></div>
              <div class="tool"><div class="tool-name">generate_uuid</div><div class="tool-category">Utility</div></div>
              <div class="tool"><div class="tool-name">timestamp</div><div class="tool-category">Utility</div></div>
              <div class="tool"><div class="tool-name">json_format</div><div class="tool-category">Utility</div></div>
              <div class="tool"><div class="tool-name">base64</div><div class="tool-category">Utility</div></div>
            </div>
          </div>
          
          <div class="section">
            <h2>🔐 Authentication</h2>
            <p style="color: #666; margin-bottom: 10px;">Include this header with all authenticated requests:</p>
            <div class="code-block">X-API-Key: demo-api-key</div>
          </div>
          
          <div class="section">
            <h2>🤖 AI Providers</h2>
            <p style="color: #666; margin-bottom: 10px;">OpenAI (✓ Ready) • Anthropic (configure API key) • Google Gemini (configure API key)</p>
          </div>
          
          <footer>
            API Base URL: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">/mcp</code> 
            • Protocol: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">MCP 2024-11-05</code>
          </footer>
        </div>
      </body>
      </html>
    `);
  }
  
  // Return JSON for API calls
  res.json({
    name: 'US-SPURS Advanced MCP Server',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      mcp: '/mcp',
      websocket: '/ws',
    },
    documentation: 'See /mcp/capabilities for available features',
  });
});

app.use('/mcp', validateApiKey, mcpRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

setupWebSocket(server);

const PORT = config.port;
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`US-SPURS MCP Server started`, {
    port: PORT,
    env: config.nodeEnv,
  });
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║          US-SPURS Advanced MCP Server v1.0.0                   ║
╠════════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                    ║
║                                                                ║
║  Endpoints:                                                    ║
║    GET  /              - Server info                           ║
║    GET  /health        - Health check                          ║
║    GET  /mcp/tools     - List available tools                  ║
║    POST /mcp/tools/call - Execute a tool                       ║
║    GET  /mcp/prompts   - List available prompts                ║
║    GET  /mcp/resources - List available resources              ║
║    WS   /ws            - WebSocket connection                  ║
║                                                                ║
║  Authentication:                                               ║
║    Include X-API-Key header (demo: demo-api-key)               ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason });
});

module.exports = app;
