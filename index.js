require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { validateApiKey } = require('./src/middleware/auth');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { setupWebSocket } = require('./src/websocket/handler');
const { registry } = require('./src/mcp/toolRegistry');

require('./src/tools');

registry.initialize().catch(err => {
  logger.warn('Failed to initialize dynamic tool registry', { error: err.message });
});

const mcpRoutes = require('./src/routes/mcp');
const healthRoutes = require('./src/routes/health');
const settingsRoutes = require('./src/routes/settings');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: '*',
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
  if (!req.path.startsWith('/css') && !req.path.startsWith('/js') && !req.path.startsWith('/images')) {
    logger.info('Request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

app.use('/health', healthRoutes);

app.get('/api/info', (req, res) => {
  res.json({
    name: 'SPURS MCP Server',
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
app.use('/api/settings', validateApiKey, settingsRoutes);

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/mcp') && !req.path.startsWith('/health') && !req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    if (!req.path.includes('.') || req.path.endsWith('.html')) {
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  }
  next();
});

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

setupWebSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`SPURS MCP Server started`, {
    port: PORT,
    env: config.nodeEnv,
  });
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                SPURS MCP Server v1.0.0                         ║
╠════════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                    ║
║                                                                ║
║  Web Interface:                                                ║
║    http://localhost:${PORT}                                        ║
║                                                                ║
║  API Endpoints:                                                ║
║    GET  /health        - Health check                          ║
║    GET  /mcp/tools     - List available tools                  ║
║    POST /mcp/tools/call - Execute a tool                       ║
║    POST /mcp/sampling/create - AI completions                  ║
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
