/**
 * SPURS MCP Server Configuration
 * Centralized configuration with validation and environment-specific defaults
 */
require('dotenv').config();

const DEFAULT_PORT = 5000;
const DEFAULT_RATE_LIMIT = 100;
const MAX_RATE_LIMIT = 10000;
const MIN_RATE_LIMIT = 1;

/**
 * Parse and validate integer from environment variable
 * @param {string} value - Environment variable value
 * @param {number} defaultValue - Default if parsing fails
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number}
 */
function parseIntEnv(value, defaultValue, min = 0, max = Infinity) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Parse comma-separated list from environment variable
 * @param {string} value - Environment variable value
 * @param {string[]} defaultValue - Default array
 * @returns {string[]}
 */
function parseListEnv(value, defaultValue) {
  if (!value || typeof value !== 'string') return defaultValue;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isDevelopment = nodeEnv === 'development';
const isProduction = nodeEnv === 'production';

const config = {
  port: parseIntEnv(process.env.PORT, DEFAULT_PORT, 1, 65535),
  nodeEnv,
  isDevelopment,
  isProduction,
  
  security: {
    apiKeyHeader: 'X-API-Key',
    corsOrigins: parseListEnv(process.env.CORS_ORIGINS, ['*']),
    encryptionKey: process.env.ENCRYPTION_KEY,
  },
  
  rateLimit: {
    windowMs: parseIntEnv(process.env.RATE_LIMIT_WINDOW_MS, 60000, 1000, 3600000),
    max: parseIntEnv(process.env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT, MIN_RATE_LIMIT, MAX_RATE_LIMIT),
  },
  
  ai: {
    OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    openai: {
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
    },
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY,
      defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.0-flash',
    },
  },
  
  evolution: {
    enabled: process.env.EVOLUTION_ENABLED !== 'false',
    githubToken: process.env.GITHUB_API_KEY || process.env.GITHUB_TOKEN,
    postmanApiKey: process.env.POSTMAN_API_KEY,
    maxGenerationAttempts: parseIntEnv(process.env.EVOLUTION_MAX_ATTEMPTS, 3, 1, 10),
    sandboxTimeout: parseIntEnv(process.env.SANDBOX_TIMEOUT_MS, 5000, 1000, 30000),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    includeTimestamp: true,
  },
  
  database: {
    url: process.env.DATABASE_URL,
  },
};

Object.freeze(config);
Object.freeze(config.security);
Object.freeze(config.rateLimit);
Object.freeze(config.ai);
Object.freeze(config.ai.openai);
Object.freeze(config.ai.anthropic);
Object.freeze(config.ai.gemini);
Object.freeze(config.evolution);
Object.freeze(config.logging);
Object.freeze(config.database);

module.exports = config;
