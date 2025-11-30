# US-SPURS Advanced MCP Server

[![Classification: OFFICIAL USE ONLY](https://img.shields.io/badge/Classification-OFFICIAL%20USE%20ONLY-red.svg)]()
[![Status: Production](https://img.shields.io/badge/Status-Production-green.svg)]()
[![AWS: CloudFormation](https://img.shields.io/badge/AWS-CloudFormation-orange.svg)]()

**US Department of Special Projects and Unified Response Services (US-SPURS)**

---

## Overview

The US-SPURS Advanced MCP Server is a highly secure, scalable, and production-ready Model Context Protocol (MCP) server infrastructure designed for seamless integration with multiple AI platforms including OpenAI, Anthropic Claude, Google Gemini, and others.

## Features

- **Multi-AI Platform Support**: Native compatibility with leading AI platforms
- **Enterprise Security**: End-to-end encryption, KMS integration, and federal compliance
- **High Availability**: Auto-scaling, load balancing, and multi-AZ deployment
- **Advanced Tool Registry**: Extensible framework for custom AI capabilities
- **Real-time Communication**: WebSocket support for low-latency interactions
- **Comprehensive Monitoring**: CloudWatch integration with custom dashboards
- **Federal Compliance**: Classification-aware operations and audit logging

## Architecture

The infrastructure is built on AWS using CloudFormation and includes:

- **VPC**: Isolated network with public/private subnets
- **EC2 Auto Scaling**: Dynamic scaling based on demand
- **Application Load Balancer**: High-availability traffic distribution
- **RDS PostgreSQL**: Multi-AZ database for persistent storage
- **S3**: Encrypted object storage for files and artifacts
- **KMS**: Centralized key management for encryption
- **CloudWatch**: Comprehensive logging and monitoring
- **Secrets Manager**: Secure credential storage

## Quick Start

### Prerequisites

- AWS CLI configured with appropriate credentials
- EC2 Key Pair in your target region
- Node.js 18+ (for local development)
- Docker and Docker Compose (for local development)

### Deployment

1. **Clone the repository**:
```bash
			git clone https://github.com//us-spurs-advanced-mcp-server.git
			cd us-spurs-advanced-mcp-server
```

2. **Deploy infrastructure**:
```bash
			cd infrastructure/scripts
			chmod +x deploy.sh
			./deploy.sh --stack-name us-spurs-mcp-prod --key-pair your-key-pair
```

3. **Configure API keys**:
```bash
			aws secretsmanager update-secret \
					--secret-id us-spurs-mcp-prod-api-keys \
					--secret-string file://api-keys.json
```

4. **Verify deployment**:
```bash
			curl -k https://YOUR-ALB-DNS/health
```

## Local Development

1. **Install dependencies**:
```bash
			cd server
			npm install
```

2. **Set up environment**:
```bash
			cp .env.example .env
			# Edit .env with your configuration
```

3. **Generate SSL certificates**:
```bash
			../scripts/generate-certs.sh
```

4. **Start development server**:
```bash
			npm run dev
```

## API Documentation

See [docs/API.md](docs/API.md) for complete API documentation.

### Example Request
```bash
curl -X POST https://your-mcp-server.com/mcp/tools/call \
		-H "X-API-Key: your-api-key" \
		-H "Content-Type: application/json" \
		-d '{
				"name": "web_search",
				"arguments": {
						"query": "latest AI developments",
						"max_results": 10
				}
		}'
```

## Client Integration

See [client-examples/](client-examples/) for integration examples with different AI platforms.

## Security

- All data is encrypted at rest using AWS KMS
- TLS 1.3 for data in transit
- API key authentication with scoped permissions
- Rate limiting and DDoS protection
- Regular security audits and compliance checks

See [SECURITY.md](SECURITY.md) for security policies and reporting vulnerabilities.

## Monitoring

Access the CloudWatch dashboard at:
AWS Console → CloudWatch → Dashboards → us-spurs-mcp-prod-mcp-dashboard

## Support

For issues, questions, or support:
- Internal: US-SPURS Agency Technical Operations
- Classification Level: OFFICIAL USE ONLY
- Director Authorization: Philip Allen Cotton Jr.

## License

PROPRIETARY - US Department of Special Projects and Unified Response Services (US-SPURS)

This software is classified as OFFICIAL USE ONLY and is restricted to authorized personnel only.

---