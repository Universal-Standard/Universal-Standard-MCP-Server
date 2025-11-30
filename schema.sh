us-spurs-advanced-mcp-server/
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── security-scan.yml
├── infrastructure/
│   ├── cloudformation/
│   │   └── mcp-server-template.yaml
│   ├── terraform/ (optional alternative)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── scripts/
│       ├── deploy.sh
│       └── cleanup.sh
├── server/
│   ├── src/
│   │   ├── index.js
│   │   ├── server.js
│   │   ├── mcp/
│   │   │   ├── MCPServer.js
│   │   │   ├── tools/
│   │   │   │   ├── webSearch.js
│   │   │   │   ├── fileOperations.js
│   │   │   │   └── dataAnalysis.js
│   │   │   ├── resources/
│   │   │   │   └── ResourceManager.js
│   │   │   └── prompts/
│   │   │       └── PromptManager.js
│   │   ├── middleware/
│   │   │   ├── authentication.js
│   │   │   ├── rateLimit.js
│   │   │   └── security.js
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── aws.js
│   │   │   └── encryption.js
│   │   └── config/
│   │       ├── default.js
│   │       ├── production.js
│   │       └── development.js
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── mcp.test.js
│   │   │   └── tools.test.js
│   │   └── integration/
│   │       └── api.test.js
│   ├── package.json
│   ├── package-lock.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .dockerignore
├── client-examples/
│   ├── openai/
│   │   └── mcp-client-example.py
│   ├── anthropic/
│   │   └── mcp-client-example.py
│   ├── google/
│   │   └── mcp-client-example.py
│   └── javascript/
│       └── mcp-client-example.js
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY.md
│   ├── ARCHITECTURE.md
│   └── TROUBLESHOOTING.md
├── scripts/
│   ├── setup-dev-environment.sh
│   ├── generate-certs.sh
│   └── rotate-secrets.sh
├── .gitignore
├── .env.example
├── README.md
├── LICENSE
└── SECURITY.md