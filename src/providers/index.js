const { OpenAIProvider } = require('./openai');
const { AnthropicProvider } = require('./anthropic');
const { GeminiProvider } = require('./gemini');
const logger = require('../utils/logger');

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = 'openai';
    
    this.registerProvider('openai', new OpenAIProvider());
    this.registerProvider('anthropic', new AnthropicProvider());
    this.registerProvider('gemini', new GeminiProvider());
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
    logger.info(`AI provider registered: ${name}`);
  }

  getProvider(name, requireConfigured = true) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      const error = new Error(`Unknown provider: ${providerName}. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
    
    if (requireConfigured && provider.isConfigured && !provider.isConfigured()) {
      const error = new Error(`Provider '${providerName}' is not configured. Please set the required API key.`);
      error.statusCode = 503;
      error.providerName = providerName;
      throw error;
    }
    
    return provider;
  }

  listProviders() {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      configured: provider.isConfigured ? provider.isConfigured() : true,
      defaultModel: provider.defaultModel || 'unknown',
    }));
  }

  async chat(messages, options = {}) {
    const provider = this.getProvider(options.provider);
    
    try {
      return await provider.chat(messages, options);
    } catch (error) {
      logger.error(`Provider ${options.provider || this.defaultProvider} chat error`, { 
        error: error.message,
        statusCode: error.statusCode 
      });
      
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  async *chatStream(messages, options = {}) {
    const provider = this.getProvider(options.provider);
    
    try {
      yield* provider.chatStream(messages, options);
    } catch (error) {
      logger.error(`Provider ${options.provider || this.defaultProvider} stream error`, { 
        error: error.message,
        statusCode: error.statusCode
      });
      
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  setDefaultProvider(name) {
    const provider = this.getProvider(name, false);
    if (!provider.isConfigured || !provider.isConfigured()) {
      logger.warn(`Setting default provider to ${name} but it may not be configured`);
    }
    this.defaultProvider = name;
    logger.info(`Default AI provider set to: ${name}`);
  }
  
  getConfiguredProviders() {
    return Array.from(this.providers.entries())
      .filter(([name, provider]) => !provider.isConfigured || provider.isConfigured())
      .map(([name]) => name);
  }
}

const providerManager = new ProviderManager();

module.exports = { ProviderManager, providerManager, OpenAIProvider, AnthropicProvider, GeminiProvider };
