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
