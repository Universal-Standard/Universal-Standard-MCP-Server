/**
 * AI Chat Tools
 * Tools for interacting with AI providers
 */
const { registry } = require('../mcp/toolRegistry');
const { providerManager, SUPPORTED_PROVIDERS } = require('../providers');
const logger = require('../utils/logger');

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 100000;
const MAX_TEXT_LENGTH = 200000;
const DEFAULT_MAX_TOKENS = 8192;
const MAX_TOKENS_LIMIT = 128000;

/**
 * Validate chat messages array
 * @param {Array} messages - Messages to validate
 * @returns {Object} Validation result
 */
function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }
  
  if (messages.length === 0) {
    return { valid: false, error: 'At least one message is required' };
  }
  
  if (messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Maximum ${MAX_MESSAGES} messages allowed` };
  }
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
      return { valid: false, error: `Message ${i}: invalid role` };
    }
    if (typeof msg.content !== 'string') {
      return { valid: false, error: `Message ${i}: content must be a string` };
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message ${i}: exceeds maximum length` };
    }
  }
  
  return { valid: true };
}

registry.register({
  name: 'ai_chat',
  description: 'Chat with an AI model. Supports OpenAI, Anthropic, and Gemini providers.',
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
            content: { type: 'string', maxLength: MAX_MESSAGE_LENGTH },
          },
          required: ['role', 'content'],
        },
        minItems: 1,
        maxItems: MAX_MESSAGES,
      },
      provider: {
        type: 'string',
        enum: SUPPORTED_PROVIDERS,
        description: 'AI provider to use',
        default: 'openai',
      },
      model: {
        type: 'string',
        description: 'AI model to use (provider-specific)',
      },
      max_tokens: {
        type: 'integer',
        description: 'Maximum tokens in response',
        default: DEFAULT_MAX_TOKENS,
        minimum: 1,
        maximum: MAX_TOKENS_LIMIT,
      },
    },
    required: ['messages'],
  },
  handler: async (args, context) => {
    const { messages, provider = 'openai', model, max_tokens = DEFAULT_MAX_TOKENS } = args;
    
    const validation = validateMessages(messages);
    if (!validation.valid) {
      return {
        content: [{ type: 'text', text: `Validation error: ${validation.error}` }],
        isError: true,
      };
    }
    
    const safeMaxTokens = Math.max(1, Math.min(parseInt(max_tokens) || DEFAULT_MAX_TOKENS, MAX_TOKENS_LIMIT));
    
    logger.info('AI chat request', { 
      messageCount: messages.length, 
      provider, 
      model,
      maxTokens: safeMaxTokens,
      userId: context?.user?.id,
    });
    
    try {
      const startTime = Date.now();
      const response = await providerManager.chat(messages, {
        provider,
        model,
        maxTokens: safeMaxTokens,
      });
      const duration = Date.now() - startTime;
      
      return {
        content: [{
          type: 'text',
          text: response.content,
        }],
        metadata: {
          provider,
          model: response.model,
          usage: response.usage,
          duration: `${duration}ms`,
        },
      };
    } catch (error) {
      logger.error('AI chat failed', { 
        error: error.message, 
        provider,
        statusCode: error.statusCode,
      });
      
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
        metadata: {
          provider,
          errorCode: error.statusCode,
        },
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
        minLength: 1,
        maxLength: MAX_TEXT_LENGTH,
      },
      length: {
        type: 'string',
        enum: ['short', 'medium', 'long'],
        description: 'Desired summary length',
        default: 'medium',
      },
      provider: {
        type: 'string',
        enum: SUPPORTED_PROVIDERS,
        description: 'AI provider to use',
        default: 'openai',
      },
    },
    required: ['text'],
  },
  handler: async (args, context) => {
    const { text, length = 'medium', provider = 'openai' } = args;
    
    if (!text || typeof text !== 'string') {
      return {
        content: [{ type: 'text', text: 'Error: Text is required' }],
        isError: true,
      };
    }
    
    if (text.length > MAX_TEXT_LENGTH) {
      return {
        content: [{ type: 'text', text: `Error: Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` }],
        isError: true,
      };
    }
    
    const lengthPrompts = {
      short: 'Provide a brief 2-3 sentence summary.',
      medium: 'Provide a comprehensive paragraph summary.',
      long: 'Provide a detailed multi-paragraph summary with key points.',
    };
    
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant that summarizes text. ${lengthPrompts[length] || lengthPrompts.medium}`,
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
          model: response.model,
          originalLength: text.length,
          summaryLength: response.content.length,
        },
      };
    } catch (error) {
      logger.error('AI summarize failed', { error: error.message, provider });
      
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
    const configuredProviders = providerManager.getConfiguredProviders();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          providers,
          configuredCount: configuredProviders.length,
          totalCount: providers.length,
        }, null, 2),
      }],
      metadata: {
        configuredProviders,
      },
    };
  },
});

module.exports = {
  validateMessages,
  MAX_MESSAGES,
  MAX_MESSAGE_LENGTH,
};
