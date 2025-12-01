require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  security: {
    apiKeyHeader: 'X-API-Key',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  },
  
  rateLimit: {
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  ai: {
    openai: {
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      defaultModel: 'gpt-5',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: 'claude-3-5-sonnet-20241022',
    },
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY,
      defaultModel: 'gemini-2.5-flash',
    },
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;
