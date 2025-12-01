# US-SPURS Advanced MCP Server

A production-ready Model Context Protocol (MCP) server for seamless integration with multiple AI platforms.

## Requirements

- Node.js 18+ (required for native fetch API support)

## Overview

This server implements the Model Context Protocol specification, providing:
- Multi-AI platform support (OpenAI, with extensible architecture for Anthropic/Gemini)
- Tool registry system for custom AI capabilities
- WebSocket support for real-time streaming
- REST API for standard HTTP interactions
- API key authentication with scoped permissions

## Project Structure

```
├── index.js                 # Main server entry point
├── src/
│   ├── config/              # Configuration management
│   ├── middleware/          # Auth, rate limiting, error handling
│   ├── mcp/                 # MCP registries (tools, prompts, resources)
│   ├── providers/           # AI provider adapters
│   ├── routes/              # Express routes (health, mcp)
│   ├── tools/               # Built-in tool implementations
│   ├── utils/               # Logger and utilities
│   └── websocket/           # WebSocket handler
```

## Running the Server

```bash
node index.js
```

The server runs on port 3000 by default.

## API Endpoints

### Public
- `GET /` - Server information
- `GET /health` - Health check

### Authenticated (requires X-API-Key header)
- `GET /mcp/tools` - List available tools
- `POST /mcp/tools/call` - Execute a tool
- `GET /mcp/prompts` - List available prompts
- `POST /mcp/prompts/get` - Render a prompt
- `GET /mcp/resources` - List available resources
- `POST /mcp/resources/read` - Read a resource
- `GET /mcp/capabilities` - Get server capabilities

### WebSocket
- `WS /ws` - WebSocket connection for MCP protocol

## Authentication

Include the `X-API-Key` header with requests. Demo key: `demo-api-key`

## Built-in Tools

| Tool | Category | Description |
|------|----------|-------------|
| ai_chat | ai | Chat with AI models |
| ai_summarize | ai | Summarize text using AI |
| web_search | search | Search the web for information |
| code_sandbox | code | Execute JavaScript in sandbox |
| generate_uuid | utility | Generate UUIDs |
| timestamp | utility | Get current timestamp |
| json_format | utility | Format and validate JSON |
| base64 | utility | Encode/decode base64 |

## AI Integration

Uses Replit AI Integrations for OpenAI access (no API key required). Charges are billed to Replit credits.

## Recent Changes

- 2025-12-01: Initial MCP server implementation
  - Express.js server with WebSocket support
  - Tool, prompt, and resource registries
  - OpenAI provider integration
  - 8 built-in tools
  - API authentication with rate limiting
