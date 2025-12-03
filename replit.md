# SPURS MCP Server

Official Model Context Protocol (MCP) server for the US Department of Special Projects and Unified Response Services (US-SPURS).

## Overview

SPURS MCP Server is an enterprise-grade, **self-evolving** MCP server that grows its capabilities automatically using AI. When a tool is requested that doesn't exist, the server discovers implementations from GitHub and Postman, generates new tools using AI, validates them in a secure sandbox, and permanently adds them to its registry.

### Core Capabilities

- **Self-Evolving Tools** - Automatically discovers, generates, and registers new tools on-demand
- **Multi-AI Platform** - Native support for OpenAI, Anthropic Claude, and Google Gemini with automatic failover
- **Full MCP Protocol** - Complete implementation of MCP 2024-11-05 specification
- **Enterprise Security** - Encrypted secrets, RBAC, sandboxed execution, audit logging
- **Real-time Streaming** - WebSocket support for live AI response streaming
- **Production Web UI** - Modern dashboard for tool management, monitoring, and AI playground

## Requirements

- Node.js 18+ (required for native fetch API support)
- PostgreSQL database (Neon-backed)
- API keys: OpenAI (required), Anthropic, Google (optional)
- GitHub token (for auto-evolution discovery)

## Project Structure

```
├── index.js                    # Main server entry point
├── public/                     # Frontend web interface
│   ├── css/styles.css          # Production styling
│   ├── js/app.js               # Frontend application
│   └── index.html              # Single-page application
├── shared/
│   └── schema.js               # Drizzle ORM database schema
├── server/
│   ├── db.js                   # Neon PostgreSQL connection
│   └── storage.js              # CRUD operations
├── src/
│   ├── config/                 # Configuration management
│   ├── middleware/             # Auth, rate limiting, error handling
│   │   └── auth.js             # API key validation + RBAC
│   ├── mcp/                    # MCP registries
│   │   ├── toolRegistry.js     # Tool management
│   │   ├── promptRegistry.js   # Prompt templates
│   │   └── resourceRegistry.js # Resource definitions
│   ├── providers/              # AI provider adapters
│   │   ├── index.js            # Provider manager with health checks
│   │   ├── openai.js           # OpenAI integration
│   │   ├── anthropic.js        # Anthropic integration
│   │   └── gemini.js           # Google Gemini integration
│   ├── evolution/              # Auto-evolution engine
│   │   ├── orchestrator.js     # Main coordination
│   │   ├── discovery/
│   │   │   ├── github.js       # GitHub repo search
│   │   │   └── postman.js      # Postman collection search
│   │   ├── generator.js        # AI code generation
│   │   ├── sandbox.js          # Secure testing environment
│   │   └── registry.js         # Dynamic tool registration
│   ├── routes/                 # API routes
│   │   ├── mcp.js              # MCP protocol endpoints
│   │   ├── settings.js         # Configuration API
│   │   └── health.js           # Health checks
│   ├── tools/                  # Built-in tools
│   │   └── index.js            # Tool implementations
│   ├── utils/
│   │   └── logger.js           # Winston logging
│   └── websocket/
│       └── handler.js          # WebSocket MCP transport
└── docs/                       # Documentation
```

## Running the Server

```bash
node index.js
```

The server runs on port 5000 with a production-quality web interface.

## Web Interface Pages

- **Home** - Welcome page with feature overview and quick start
- **Dashboard** - Real-time monitoring, stats, and activity feed
- **Tools** - Browse, search, and execute all tools with user-friendly forms
- **Resources** - Access MCP server resources
- **AI Playground** - Interactive chat with AI providers
- **Connections** - Manage external service integrations
- **Add-ons** - Third-party extensions marketplace
- **Activity Logs** - View all API activity and audit trail
- **Settings** - Configure providers, API keys, and server settings

## API Endpoints

### Public
- `GET /` - Web interface (HTML) or server info (JSON)
- `GET /health` - Health check
- `GET /health/detailed` - Detailed status with provider health

### MCP Endpoints (requires X-API-Key header)
- `GET /mcp/tools` - List available tools (built-in + generated)
- `POST /mcp/tools/call` - Execute a tool (triggers auto-evolution if not found)
- `GET /mcp/prompts` - List prompt templates
- `POST /mcp/prompts/get` - Render a prompt
- `GET /mcp/resources` - List available resources
- `POST /mcp/resources/read` - Read a resource
- `POST /mcp/sampling/create` - AI completions with provider selection
- `GET /mcp/capabilities` - Get server capabilities

### Settings API (requires X-API-Key header)
- `GET /api/settings/stats` - Server statistics
- `GET /api/settings/providers` - List AI providers with health status
- `POST /api/settings/providers/:name/test` - Test provider connection
- `PUT /api/settings/providers/:name` - Update provider configuration
- `GET /api/settings/server` - Server configuration
- `PATCH /api/settings/server` - Update settings
- `GET /api/settings/api-keys` - List API keys
- `POST /api/settings/api-keys` - Create new API key with scopes
- `DELETE /api/settings/api-keys/:id` - Revoke API key
- `GET /api/settings/activity` - Activity logs
- `GET /api/settings/audit/export` - Export audit logs (JSON/CSV)
- `GET /api/settings/generated-tools` - List auto-generated tools
- `GET /api/settings/tool-creation-logs` - Tool creation history

### WebSocket
- `WS /ws` - WebSocket connection for MCP protocol (header auth only)

## Authentication

Include the `X-API-Key` header with requests. Demo key: `demo-api-key`

API keys support scoped permissions:
- `tools:read` - List tools
- `tools:execute` - Execute tools
- `prompts:read` - List prompts
- `resources:read` - Read resources
- `sampling:create` - Create AI completions
- `admin:*` - Full administrative access

## Built-in Tools

| Tool | Category | Description |
|------|----------|-------------|
| ai_chat | ai | Chat with AI models (OpenAI, Anthropic, Gemini) |
| ai_summarize | ai | Summarize text using AI |
| ai_providers | ai | List available AI providers and status |
| web_search | search | Search the web for information |
| code_sandbox | code | Execute code in secure isolated sandbox |
| generate_uuid | utility | Generate UUIDs |
| timestamp | utility | Get current timestamp |
| json_format | utility | Format and validate JSON |
| base64 | utility | Encode/decode base64 |

## Auto-Evolution Engine

When a tool is requested that doesn't exist:

1. **Discovery** - Search GitHub MCP repos and Postman collections
2. **Analysis** - AI analyzes found implementations
3. **Generation** - AI generates compatible tool code
4. **Testing** - Secure sandbox validation
5. **Registration** - Permanent addition to registry
6. **Execution** - Return result to user

Generated tools are stored in the database and loaded on startup.

## AI Integration

Uses Replit AI Integrations for OpenAI access (no API key required). Charges billed to Replit credits.

Additional providers:
- **Anthropic**: Set `ANTHROPIC_API_KEY` secret
- **Gemini**: Set `GOOGLE_API_KEY` secret

Provider features:
- Health monitoring with automatic failover
- Guided setup flow for new users
- Usage analytics per provider

## Database Schema

PostgreSQL (Neon-backed) with Drizzle ORM:

- **api_keys** - Encrypted storage with scopes, rate limits
- **provider_settings** - AI provider configurations
- **server_config** - Server-wide settings
- **activity_logs** - Full audit trail
- **chat_history** - AI Playground persistence
- **generated_tools** - Auto-evolution created tools
- **tool_creation_logs** - Tool creation audit trail
- **user_roles** - RBAC permissions

## Security Features

- **Encrypted Secrets** - AES-256 encryption at rest
- **RBAC** - Role-based access control
- **Sandboxed Execution** - VM-isolated code execution
- **Audit Logging** - Complete activity trail with export
- **Rate Limiting** - Per-key and global limits
- **Webhook Notifications** - Real-time security alerts
- **TLS 1.3** - Encrypted connections

## Recent Changes

- 2025-12-03: Production-quality refactoring of apiKeys.js middleware
  - Implemented LRU cache with max size limit (1000 keys) to prevent memory leaks
  - Added comprehensive input validation for name, scopes, and rate limits
  - Created scope validation against VALID_SCOPES list (10 scopes defined)
  - Improved security: proper key masking using getKeyPrefix() from encryption utility
  - Added JSDoc documentation for all functions
  - Extracted constants and configuration to top of file
  - Error handling improvements: no fallback to demo key on errors
  - New cache utility functions: clearCache(), getCacheStats()
  - Rate limit range validation (1-10000)

- 2025-12-03: Fixed provider initialization for production
  - OpenAI, Anthropic, and Gemini providers now gracefully handle missing API keys
  - Lazy initialization with try-catch error handling
  - Added isConfigured() method to all providers
  - Server starts successfully even when API keys are not configured
  - Proper error messages when attempting to use unconfigured providers

- 2025-12-03: Complete architecture documentation
  - Updated README.md with full end-state architecture
  - Documented auto-evolution engine flow
  - Added comprehensive API reference
  - Security and deployment documentation

- 2025-12-02: Navigation restructure and UX improvements
  - Renamed to "SPURS MCP Server"
  - Split Services into dedicated Tools and Resources pages
  - Added Connections and Add-ons pages
  - Implemented user-friendly tool forms
  - Added real-time search filtering
  - Fixed branding and dead code

- 2025-12-02: Full database integration
  - PostgreSQL with Drizzle ORM
  - API key management with encryption
  - Activity logging and chat history
  - Provider configuration persistence

- 2025-12-01: Initial MCP server implementation
  - Express.js with WebSocket support
  - Multi-provider AI support
  - 9 built-in tools
  - REST API and MCP protocol

## User Preferences

- Keep naming simple: "SPURS MCP Server"
- Tool forms should be user-friendly (no raw JSON)
- Self-evolving architecture is core feature
- Enterprise-grade security required
