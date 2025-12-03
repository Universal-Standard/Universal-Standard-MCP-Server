# SPURS MCP Server

<div align="center">

![SPURS MCP Server](https://img.shields.io/badge/SPURS-MCP%20Server-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyTDIgNy4zNXY5LjNMMTIgMjJsMS0xLjg1VjEzaDV2LTJoLTV2LTMuMTVsMTAtMy43NVY2bC0xMC01Wk03IDE1LjVjLS44MiAwLTEuNS0uNjgtMS41LTEuNXMuNjgtMS41IDEuNS0xLjUgMS41LjY4IDEuNSAxLjUtLjY4IDEuNS0xLjUgMS41WiIvPjwvc3ZnPg==)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-green?style=for-the-badge)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)]()
[![Status](https://img.shields.io/badge/Status-Production-success?style=for-the-badge)]()

**Official Model Context Protocol Server for the US Department of Special Projects and Unified Response Services (US-SPURS)**

[Features](#features) • [Quick Start](#quick-start) • [Architecture](#architecture) • [Tools](#tools) • [API](#api-reference) • [Security](#security)

</div>

---

## Overview

SPURS MCP Server is an enterprise-grade, **self-evolving** Model Context Protocol server that grows its capabilities automatically using AI. When a tool is requested that doesn't exist, the server discovers implementations from GitHub and Postman, generates new tools using AI, validates them in a secure sandbox, and permanently adds them to its registry.

```
┌─────────────────────────────────────────────────────────────┐
│  User Request: "I need a tool to analyze sentiment"         │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Tool exists? ─► YES ─► Execute immediately         │   │
│  │       │                                              │   │
│  │      NO                                              │   │
│  │       │                                              │   │
│  │       ▼                                              │   │
│  │  AUTO-EVOLUTION ENGINE                               │   │
│  │  1. Search GitHub + Postman for implementations     │   │
│  │  2. AI analyzes and generates tool code             │   │
│  │  3. Secure sandbox testing & validation             │   │
│  │  4. Register permanently in database                │   │
│  │  5. Execute and return result                       │   │
│  │                                                      │   │
│  │  ✓ Tool now available forever                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Self-Evolving Tools** | Automatically discovers, generates, and registers new tools on-demand |
| **Multi-AI Platform** | Native support for OpenAI, Anthropic Claude, and Google Gemini with automatic failover |
| **Full MCP Protocol** | Complete implementation of MCP 2024-11-05 specification |
| **Enterprise Security** | Encrypted secrets, RBAC, sandboxed execution, audit logging |
| **Real-time Streaming** | WebSocket support for live AI response streaming |
| **Production Web UI** | Modern dashboard for tool management, monitoring, and AI playground |

### Auto-Evolution Engine

The server's unique capability to grow itself:

- **GitHub Discovery** - Searches MCP server repositories for tool implementations
- **Postman Discovery** - Finds API collections with relevant capabilities  
- **AI Code Generation** - Uses LLMs to analyze and generate compatible tool code
- **Secure Sandbox Testing** - Validates generated tools in isolated environment
- **Dynamic Registration** - Hot-reloads new tools without server restart
- **Creation Audit Trail** - Full logging of how each tool was created

### AI Provider Management

- **Health Monitoring** - Real-time status checks for each provider
- **Automatic Failover** - Seamlessly switches providers on failure
- **Guided Setup** - Step-by-step configuration for new users
- **Usage Analytics** - Track API usage and costs per provider

---

## Quick Start

### Prerequisites

- Node.js 18+ (required for native fetch API)
- PostgreSQL database (Neon-backed recommended)
- API keys for AI providers (OpenAI required, others optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/US-SPURS/spurs-mcp-server.git
cd spurs-mcp-server

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run db:push

# Start the server
npm start
```

### MCP Client Configuration

Add to your Claude Desktop or MCP client configuration:

```json
{
  "mcpServers": {
    "spurs": {
      "url": "http://localhost:5000",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}
```

### Verify Installation

```bash
# Health check
curl http://localhost:5000/health

# List available tools
curl -H "X-API-Key: demo-api-key" http://localhost:5000/mcp/tools

# Execute a tool
curl -X POST http://localhost:5000/mcp/tools/call \
  -H "X-API-Key: demo-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "generate_uuid", "arguments": {"count": 3}}'
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SPURS MCP SERVER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   WEB UI     │    │   REST API   │    │  WEBSOCKET   │                   │
│  │  Port 5000   │    │   /mcp/*     │    │    /ws       │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                            │
│         └───────────────────┼───────────────────┘                            │
│                             ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SECURITY LAYER                                    │    │
│  │                                                                      │    │
│  │  • API Key Authentication      • Role-Based Access Control (RBAC)  │    │
│  │  • Rate Limiting (per key)     • Request Validation                 │    │
│  │  • Encrypted Secret Storage    • Audit Logging                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                             │                                                │
│                             ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       TOOL ROUTER                                    │    │
│  │                                                                      │    │
│  │   Tool Request ──► Exists? ──► YES ──► Execute & Return             │    │
│  │                        │                                             │    │
│  │                       NO                                             │    │
│  │                        ▼                                             │    │
│  │        ┌───────────────────────────────────────┐                    │    │
│  │        │      AUTO-EVOLUTION ENGINE            │                    │    │
│  │        │                                       │                    │    │
│  │        │  Discovery ─► Analysis ─► Generation  │                    │    │
│  │        │      │                                │                    │    │
│  │        │      ▼                                │                    │    │
│  │        │  Testing ─► Validation ─► Registration│                    │    │
│  │        └───────────────────────────────────────┘                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                             │                                                │
│         ┌───────────────────┼───────────────────┐                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │  BUILT-IN   │    │  GENERATED  │    │     AI      │                     │
│  │   TOOLS     │    │    TOOLS    │    │  PROVIDERS  │                     │
│  │             │    │             │    │             │                     │
│  │  9 core     │    │  Unlimited  │    │  OpenAI     │                     │
│  │  utilities  │    │  AI-created │    │  Anthropic  │                     │
│  │             │    │  tools      │    │  Gemini     │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                             │                                                │
│                             ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    POSTGRESQL DATABASE                               │    │
│  │                                                                      │    │
│  │  api_keys          │ provider_settings  │ activity_logs             │    │
│  │  generated_tools   │ chat_history       │ tool_creation_logs        │    │
│  │  server_config     │ audit_trail        │ user_roles                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
spurs-mcp-server/
├── index.js                    # Main server entry point
├── package.json                # Dependencies and scripts
│
├── public/                     # Web interface
│   ├── index.html              # Single-page application
│   ├── css/styles.css          # Production styling
│   └── js/app.js               # Frontend application
│
├── server/                     # Database layer
│   ├── db.js                   # Neon PostgreSQL connection
│   └── storage.js              # CRUD operations
│
├── shared/
│   └── schema.js               # Drizzle ORM schema
│
├── src/
│   ├── config/                 # Configuration management
│   │   └── index.js
│   │
│   ├── middleware/             # Express middleware
│   │   ├── auth.js             # API key validation + RBAC
│   │   └── errorHandler.js     # Error handling
│   │
│   ├── mcp/                    # MCP registries
│   │   ├── toolRegistry.js     # Tool management
│   │   ├── promptRegistry.js   # Prompt templates
│   │   └── resourceRegistry.js # Resource definitions
│   │
│   ├── providers/              # AI provider adapters
│   │   ├── index.js            # Provider manager
│   │   ├── openai.js           # OpenAI integration
│   │   ├── anthropic.js        # Anthropic integration
│   │   └── gemini.js           # Google Gemini integration
│   │
│   ├── evolution/              # Auto-evolution engine
│   │   ├── orchestrator.js     # Main coordination
│   │   ├── discovery/
│   │   │   ├── github.js       # GitHub repo search
│   │   │   └── postman.js      # Postman collection search
│   │   ├── generator.js        # AI code generation
│   │   ├── sandbox.js          # Secure testing environment
│   │   └── registry.js         # Dynamic tool registration
│   │
│   ├── routes/                 # API routes
│   │   ├── mcp.js              # MCP protocol endpoints
│   │   ├── settings.js         # Configuration API
│   │   └── health.js           # Health checks
│   │
│   ├── tools/                  # Built-in tools
│   │   └── index.js            # Tool implementations
│   │
│   ├── utils/
│   │   └── logger.js           # Winston logging
│   │
│   └── websocket/
│       └── handler.js          # WebSocket MCP transport
│
└── docs/                       # Documentation
    ├── API.md                  # API reference
    ├── SECURITY.md             # Security policies
    └── TOOLS.md                # Tool development guide
```

---

## Tools

### Built-in Tools

| Tool | Category | Description | Status |
|------|----------|-------------|--------|
| `ai_chat` | AI | Chat with AI models (OpenAI, Anthropic, Gemini) | ✅ Production |
| `ai_summarize` | AI | Summarize text using AI with configurable length | ✅ Production |
| `ai_providers` | AI | List available AI providers and their status | ✅ Production |
| `web_search` | Search | Search the web and return structured results | ✅ Production |
| `code_sandbox` | Code | Execute code in secure isolated sandbox | ✅ Production |
| `generate_uuid` | Utility | Generate one or more UUIDs | ✅ Production |
| `timestamp` | Utility | Get current timestamp in various formats | ✅ Production |
| `json_format` | Utility | Format, validate, and transform JSON | ✅ Production |
| `base64` | Utility | Encode/decode base64 strings | ✅ Production |

### Auto-Generated Tools

Tools created by the auto-evolution engine are stored in the database and loaded dynamically:

```javascript
// Example: Auto-generated sentiment analysis tool
{
  name: "sentiment_analysis",
  description: "Analyze sentiment of text (positive, negative, neutral)",
  category: "ai",
  source: "github:user/mcp-sentiment-server",
  created_at: "2024-12-02T10:30:00Z",
  usage_count: 1547,
  status: "active"
}
```

### Creating Custom Tools

Tools follow a standard schema:

```javascript
{
  name: "my_tool",
  description: "What this tool does",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "First parameter" },
      param2: { type: "integer", description: "Second parameter", default: 10 }
    },
    required: ["param1"]
  },
  handler: async (args) => {
    // Tool implementation
    return { result: "success", data: args.param1 };
  }
}
```

---

## API Reference

### Authentication

All API requests require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" https://your-server.com/mcp/tools
```

### MCP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |
| `GET` | `/mcp/capabilities` | Server capabilities and protocol version |
| `GET` | `/mcp/tools` | List all available tools |
| `POST` | `/mcp/tools/call` | Execute a tool |
| `GET` | `/mcp/prompts` | List prompt templates |
| `POST` | `/mcp/prompts/get` | Render a prompt template |
| `GET` | `/mcp/resources` | List available resources |
| `POST` | `/mcp/resources/read` | Read a resource |
| `POST` | `/mcp/sampling/create` | Create AI completion |

### Settings API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings/stats` | Server statistics |
| `GET` | `/api/settings/providers` | List AI providers |
| `POST` | `/api/settings/providers/:name/test` | Test provider connection |
| `PUT` | `/api/settings/providers/:name` | Update provider config |
| `GET` | `/api/settings/api-keys` | List API keys |
| `POST` | `/api/settings/api-keys` | Create new API key |
| `DELETE` | `/api/settings/api-keys/:id` | Revoke API key |
| `GET` | `/api/settings/activity` | Activity logs |
| `GET` | `/api/settings/audit/export` | Export audit logs (JSON/CSV) |

### WebSocket

Connect to `/ws` for real-time MCP communication:

```javascript
const ws = new WebSocket('wss://your-server.com/ws', {
  headers: { 'X-API-Key': 'your-api-key' }
});

ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'tools/call',
  params: { name: 'ai_chat', arguments: { message: 'Hello!' } },
  id: 1
}));
```

### Example Requests

**Execute a Tool:**
```bash
curl -X POST https://your-server.com/mcp/tools/call \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ai_chat",
    "arguments": {
      "message": "Explain quantum computing in simple terms",
      "provider": "openai"
    }
  }'
```

**AI Completion:**
```bash
curl -X POST https://your-server.com/mcp/sampling/create \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Write a haiku about technology"}
    ],
    "provider": "anthropic",
    "maxTokens": 100
  }'
```

---

## Web Interface

Access the web UI at `http://localhost:5000` with these pages:

| Page | Description |
|------|-------------|
| **Home** | Welcome page with feature overview and quick start |
| **Dashboard** | Real-time monitoring, stats, and activity feed |
| **Tools** | Browse, search, and execute all tools with user-friendly forms |
| **Resources** | Access MCP server resources |
| **AI Playground** | Interactive chat with AI providers |
| **Connections** | Manage external service integrations |
| **Add-ons** | Third-party extensions marketplace |
| **Activity Logs** | View all API activity and audit trail |
| **Settings** | Configure providers, API keys, and server settings |

---

## Security

### Authentication & Authorization

- **API Key Authentication** - Secure key validation on all protected routes
- **Role-Based Access Control (RBAC)** - Granular permissions per key
- **Scoped Permissions** - Limit keys to specific tools or operations

### Secret Management

- **Encrypted Storage** - All secrets encrypted at rest using AES-256
- **No Plain Text** - API keys and provider secrets never stored in plain text
- **Secure Headers** - API keys only accepted in headers (never query params)

### Code Execution Safety

- **Isolated Sandbox** - Generated tools run in VM-isolated environment
- **Resource Limits** - CPU, memory, and time limits enforced
- **Security Scanning** - All generated code scanned before registration
- **No Arbitrary Execution** - Only validated, sandboxed code can run

### Audit & Compliance

- **Complete Audit Trail** - Every API action logged with timestamp and user
- **Export Capabilities** - Audit logs exportable as JSON or CSV
- **Webhook Notifications** - Real-time alerts for security events
- **Data Retention Policies** - Configurable log retention periods

### Network Security

- **TLS 1.3** - All connections encrypted in transit
- **Rate Limiting** - Per-key and global rate limits
- **CORS Protection** - Configurable allowed origins
- **DDoS Protection** - Built-in request throttling

---

## Configuration

### Environment Variables

```bash
# Server
PORT=5000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/spurs_mcp

# AI Providers (via Replit Integrations or manual)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Discovery APIs
GITHUB_TOKEN=ghp_...
POSTMAN_API_KEY=...

# Security
ENCRYPTION_KEY=your-32-byte-encryption-key
JWT_SECRET=your-jwt-secret

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

### Provider Configuration

Configure AI providers via the Settings API or web interface:

```json
{
  "openai": {
    "enabled": true,
    "model": "gpt-4o-mini",
    "maxTokens": 4096,
    "temperature": 0.7
  },
  "anthropic": {
    "enabled": true,
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4096
  },
  "gemini": {
    "enabled": false,
    "model": "gemini-pro"
  }
}
```

---

## Database Schema

### Core Tables

```sql
-- API Keys with encryption
api_keys (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  key_hash VARCHAR(255),      -- Hashed key for validation
  key_prefix VARCHAR(10),     -- First 8 chars for identification
  scopes JSONB,               -- Permissions array
  rate_limit INTEGER,
  expires_at TIMESTAMP,
  created_at TIMESTAMP,
  last_used_at TIMESTAMP
)

-- Generated Tools
generated_tools (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE,
  description TEXT,
  category VARCHAR(50),
  input_schema JSONB,
  handler_code TEXT,          -- Encrypted
  source_type VARCHAR(50),    -- github, postman, ai
  source_url TEXT,
  version INTEGER,
  status VARCHAR(20),         -- testing, active, disabled
  test_results JSONB,
  created_at TIMESTAMP,
  last_used_at TIMESTAMP,
  usage_count INTEGER
)

-- Tool Creation Logs
tool_creation_logs (
  id UUID PRIMARY KEY,
  tool_id UUID REFERENCES generated_tools(id),
  stage VARCHAR(50),          -- discovery, analysis, generation, testing, registration
  status VARCHAR(20),
  details JSONB,
  ai_prompt_used TEXT,
  ai_response TEXT,
  created_at TIMESTAMP
)

-- Activity Logs
activity_logs (
  id UUID PRIMARY KEY,
  action VARCHAR(100),
  api_key_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP
)
```

---

## Monitoring & Observability

### Health Checks

```bash
# Basic health
GET /health
→ { "status": "healthy", "uptime": 86400, "version": "1.0.0" }

# Detailed status
GET /health/detailed
→ {
    "status": "healthy",
    "database": "connected",
    "providers": {
      "openai": "healthy",
      "anthropic": "healthy",
      "gemini": "degraded"
    },
    "tools": { "builtin": 9, "generated": 47 },
    "memory": { "used": "256MB", "total": "512MB" }
  }
```

### Metrics

- Request count and latency per endpoint
- Tool execution success/failure rates
- AI provider usage and costs
- Auto-evolution success rate
- Database connection pool status

### Webhook Notifications

Configure webhooks for real-time alerts:

```json
{
  "webhook_url": "https://your-service.com/webhook",
  "events": [
    "tool.created",
    "tool.failed",
    "provider.down",
    "security.alert"
  ]
}
```

---

## Development

### Running Locally

```bash
# Development mode with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Push database changes
npm run db:push
```

### Adding Built-in Tools

```javascript
// src/tools/myTool.js
const { toolRegistry } = require('../mcp/toolRegistry');

toolRegistry.register({
  name: 'my_custom_tool',
  description: 'Does something useful',
  category: 'utility',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input value' }
    },
    required: ['input']
  },
  handler: async (args) => {
    return { result: args.input.toUpperCase() };
  }
});
```

---

## Deployment

### Replit Deployment

The server is configured for one-click deployment on Replit:

1. Fork the repository to your Replit account
2. Set environment variables in Secrets
3. Click "Run" to start the server
4. Use the provided URL for API access

### Docker Deployment

```bash
# Build image
docker build -t spurs-mcp-server .

# Run container
docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL=your-db-url \
  -e OPENAI_API_KEY=your-key \
  spurs-mcp-server
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure TLS/HTTPS termination
- [ ] Set strong encryption keys
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Set up monitoring/alerts
- [ ] Configure backup strategy
- [ ] Review CORS settings

---

## Support

| Resource | Link |
|----------|------|
| Documentation | [docs/](./docs/) |
| API Reference | [docs/API.md](./docs/API.md) |
| Security Policy | [SECURITY.md](./SECURITY.md) |
| Issue Tracker | Internal SPURS ticket system |

### Contact

- **Organization**: US Department of Special Projects and Unified Response Services (US-SPURS)
- **Classification**: OFFICIAL USE ONLY
- **Director Authorization**: Philip Allen Cotton Jr.

---

## License

**PROPRIETARY** - US Department of Special Projects and Unified Response Services (US-SPURS)

This software is classified as OFFICIAL USE ONLY and is restricted to authorized personnel only. Unauthorized access, use, or distribution is prohibited.

---

<div align="center">

**SPURS MCP Server** - Self-Evolving AI Infrastructure

*Building the future of AI tool orchestration*

</div>
