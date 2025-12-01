const { registry } = require('../mcp/toolRegistry');
const { providerManager } = require('../providers');
const logger = require('../utils/logger');

registry.register({
  name: 'ai_chat',
  description: 'Chat with an AI model to get responses. Supports OpenAI, Anthropic, and Gemini providers.',
  category: 'ai',
  inputSchema: {
    type: 'object',
    properties: {
      messages: {
        type: 'array',
        description: 'Array of message objects with role and content',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['system', 'user', 'assistant'] },
            content: { type: 'string' },
          },
        },
      },
      provider: {
        type: 'string',
        enum: ['openai', 'anthropic', 'gemini'],
        description: 'AI provider to use (default: openai)',
        default: 'openai',
      },
      model: {
        type: 'string',
        description: 'AI model to use (provider-specific)',
      },
      max_tokens: {
        type: 'integer',
        description: 'Maximum tokens in response',
        default: 8192,
      },
    },
    required: ['messages'],
  },
  handler: async (args, context) => {
    const { messages, provider = 'openai', model, max_tokens } = args;
    
    logger.info('AI chat request', { messageCount: messages.length, provider, model });
    
    try {
      const response = await providerManager.chat(messages, {
        provider,
        model,
        maxTokens: max_tokens,
      });
      
      return {
        content: [{
          type: 'text',
          text: response.content,
        }],
        metadata: {
          provider,
          model: response.model,
          usage: response.usage,
        },
      };
    } catch (error) {
      logger.error('AI chat failed', { error: error.message });
      
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  },
});

registry.register({
  name: 'ai_summarize',
  description: 'Summarize text using AI. Supports multiple AI providers.',
  category: 'ai',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to summarize',
      },
      length: {
        type: 'string',
        enum: ['short', 'medium', 'long'],
        description: 'Desired summary length',
        default: 'medium',
      },
      provider: {
        type: 'string',
        enum: ['openai', 'anthropic', 'gemini'],
        description: 'AI provider to use (default: openai)',
        default: 'openai',
      },
    },
    required: ['text'],
  },
  handler: async (args, context) => {
    const { text, length = 'medium', provider = 'openai' } = args;
    
    const lengthPrompts = {
      short: 'Provide a brief 2-3 sentence summary.',
      medium: 'Provide a comprehensive paragraph summary.',
      long: 'Provide a detailed multi-paragraph summary with key points.',
    };
    
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant that summarizes text. ${lengthPrompts[length]}`,
      },
      {
        role: 'user',
        content: `Please summarize the following text:\n\n${text}`,
      },
    ];
    
    try {
      const response = await providerManager.chat(messages, { provider });
      
      return {
        content: [{
          type: 'text',
          text: response.content,
        }],
        metadata: {
          provider,
        },
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  },
});

registry.register({
  name: 'ai_providers',
  description: 'List available AI providers and their configuration status',
  category: 'ai',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (args, context) => {
    const providers = providerManager.listProviders();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ providers }, null, 2),
      }],
    };
  },
});

module.exports = {};
