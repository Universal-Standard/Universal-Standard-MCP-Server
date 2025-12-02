# US-SPURS Advanced MCP Server

A production-ready Model Context Protocol (MCP) server for seamless integration with multiple AI platforms.

## Requirements

- Node.js 18+ (required for native fetch API support)

## Overview

This server implements the Model Context Protocol specification, providing:
- Multi-AI platform support (OpenAI, Anthropic Claude, Google Gemini)
- Production-quality web interface with dashboard, settings, and AI playground
- Tool registry system for custom AI capabilities
- WebSocket support for real-time streaming
- REST API for standard HTTP interactions
- API key authentication with scoped permissions

## Project Structure

```
├── index.js                 # Main server entry point
├── public/                  # Frontend web interface
│   ├── css/styles.css       # Production-quality CSS
│   ├── js/app.js            # Frontend JavaScript application
│   └── index.html           # Main SPA template
├── src/
│   ├── config/              # Configuration management
│   ├── middleware/          # Auth, rate limiting, error handling
│   ├── mcp/                 # MCP registries (tools, prompts, resources)
│   ├── providers/           # AI provider adapters
│   ├── routes/              # Express routes (health, mcp, settings)
│   ├── tools/               # Built-in tool implementations
│   ├── utils/               # Logger and utilities
│   └── websocket/           # WebSocket handler
```

## Running the Server

```bash
node index.js
```

The server runs on port 5000 with a production-quality web interface.

## Web Interface Pages

- **Home** - Welcome page with feature overview
- **Dashboard** - Real-time monitoring with stats and activity logs
- **Services** - Browse tools, prompts, and resources
- **AI Playground** - Interactive chat with AI providers
- **Settings** - Configure AI providers and server settings
- **About** - Platform information and technical specs

## API Endpoints

### Public
- `GET /` - Web interface (HTML) or server info (JSON)
- `GET /health` - Health check

### MCP Endpoints (requires X-API-Key header)
- `GET /mcp/tools` - List available tools
- `POST /mcp/tools/call` - Execute a tool
- `GET /mcp/prompts` - List available prompts
- `POST /mcp/prompts/get` - Render a prompt
- `GET /mcp/resources` - List available resources
- `POST /mcp/resources/read` - Read a resource
- `POST /mcp/sampling/create` - AI completions
- `GET /mcp/capabilities` - Get server capabilities

### Settings API (requires X-API-Key header)
- `GET /api/settings/stats` - Server statistics
- `GET /api/settings/providers` - List AI providers
- `POST /api/settings/providers/:name/test` - Test provider connection
- `GET /api/settings/server` - Server configuration
- `PATCH /api/settings/server` - Update settings

### WebSocket
- `WS /ws` - WebSocket connection for MCP protocol

## Authentication

Include the `X-API-Key` header with requests. Demo key: `demo-api-key`

## Built-in Tools

| Tool | Category | Description |
|------|----------|-------------|
| ai_chat | ai | Chat with AI models |
| ai_summarize | ai | Summarize text using AI |
| ai_providers | ai | List available AI providers |
| web_search | search | Search the web for information |
| code_sandbox | code | Execute JavaScript in sandbox |
| generate_uuid | utility | Generate UUIDs |
| timestamp | utility | Get current timestamp |
| json_format | utility | Format and validate JSON |
| base64 | utility | Encode/decode base64 |

## AI Integration

Uses Replit AI Integrations for OpenAI access (no API key required). Charges are billed to Replit credits.

To enable other providers:
- **Anthropic**: Set `ANTHROPIC_API_KEY` secret
- **Gemini**: Set `GOOGLE_API_KEY` secret

## Recent Changes

- 2025-12-02: Production-quality web interface
  - Full SPA with Home, Dashboard, Services, AI Playground, Settings, About pages
  - Modern CSS with responsive design and dark sidebar
  - Interactive AI Playground for testing providers
  - Settings page for provider configuration
  - Activity logging and monitoring dashboard
  - Server moved to port 5000 for web preview

- 2025-12-01: Complete MCP server implementation
  - Express.js server with WebSocket support
  - Multi-provider AI support (OpenAI, Anthropic, Gemini)
  - Tool, prompt, and resource registries
  - 9 built-in tools with AI integration
  - REST API and WebSocket endpoints for MCP protocol
  - API authentication with rate limiting and scoped permissions
  - Provider-specific error handling with status codes
  - Comprehensive logging with Winston
