/**
 * AI Provider Manager
 * Centralized management of AI provider instances with health monitoring
 */
const { OpenAIProvider } = require('./openai');
const { AnthropicProvider } = require('./anthropic');
const { GeminiProvider } = require('./gemini');
const logger = require('../utils/logger');

const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'gemini'];
const DEFAULT_PROVIDER = 'openai';

/**
 * @class ProviderManager
 * Manages AI provider instances and routing
 */
class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = DEFAULT_PROVIDER;
    this.healthCache = new Map();
    this.healthCacheTTL = 60000;
    
    this._initializeProviders();
  }

  /**
   * Initialize all supported providers
   * @private
   */
  _initializeProviders() {
    const providerClasses = {
      openai: OpenAIProvider,
      anthropic: AnthropicProvider,
      gemini: GeminiProvider,
    };

    for (const [name, ProviderClass] of Object.entries(providerClasses)) {
      try {
        const provider = new ProviderClass();
        this.providers.set(name, provider);
        logger.info(`AI provider registered: ${name}`);
      } catch (error) {
        logger.warn(`Failed to initialize provider: ${name}`, { error: error.message });
      }
    }
  }

  /**
   * Get a provider by name
   * @param {string} name - Provider name
   * @param {boolean} requireConfigured - Whether to require the provider to be configured
   * @returns {Object} Provider instance
   * @throws {Error} If provider not found or not configured
   */
  getProvider(name, requireConfigured = true) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      const error = new Error(`Unknown provider: ${providerName}. Available: ${Array.from(this.providers.keys()).join(', ')}`);
      error.statusCode = 400;
      error.providerName = providerName;
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

  /**
   * Check if a provider exists
   * @param {string} name - Provider name
   * @returns {boolean}
   */
  hasProvider(name) {
    return this.providers.has(name);
  }

  /**
   * List all providers with their status
   * @returns {Array} Provider list with configuration status
   */
  listProviders() {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      configured: provider.isConfigured ? provider.isConfigured() : true,
      defaultModel: provider.defaultModel || provider.name || 'unknown',
      isDefault: name === this.defaultProvider,
    }));
  }

  /**
   * Get list of configured providers
   * @returns {string[]} Names of configured providers
   */
  getConfiguredProviders() {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => !provider.isConfigured || provider.isConfigured())
      .map(([name]) => name);
  }

  /**
   * Send chat messages to a provider
   * @param {Array} messages - Chat messages
   * @param {Object} options - Chat options
   * @returns {Promise<Object>} Chat response
   */
  async chat(messages, options = {}) {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.getProvider(providerName);
    const startTime = Date.now();
    
    try {
      const result = await provider.chat(messages, options);
      const duration = Date.now() - startTime;
      
      logger.debug('Provider chat completed', { 
        provider: providerName,
        duration: `${duration}ms`,
        model: result.model,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Provider ${providerName} chat error`, { 
        error: error.message,
        statusCode: error.statusCode,
        duration: `${duration}ms`,
      });
      
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      error.providerName = providerName;
      throw error;
    }
  }

  /**
   * Stream chat messages from a provider
   * @param {Array} messages - Chat messages
   * @param {Object} options - Chat options
   * @yields {string} Chat content chunks
   */
  async *chatStream(messages, options = {}) {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.getProvider(providerName);
    
    if (!provider.chatStream) {
      throw new Error(`Provider ${providerName} does not support streaming`);
    }
    
    try {
      yield* provider.chatStream(messages, options);
    } catch (error) {
      logger.error(`Provider ${providerName} stream error`, { 
        error: error.message,
        statusCode: error.statusCode,
      });
      
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      error.providerName = providerName;
      throw error;
    }
  }

  /**
   * Set the default provider
   * @param {string} name - Provider name
   */
  setDefaultProvider(name) {
    if (!this.hasProvider(name)) {
      throw new Error(`Cannot set default: provider '${name}' not found`);
    }
    
    const provider = this.getProvider(name, false);
    if (provider.isConfigured && !provider.isConfigured()) {
      logger.warn(`Setting default provider to ${name} but it may not be configured`);
    }
    
    this.defaultProvider = name;
    logger.info(`Default AI provider set to: ${name}`);
  }

  /**
   * Check health of all providers
   * @returns {Promise<Object>} Health status by provider
   */
  async checkHealth() {
    const results = {};
    
    for (const [name, provider] of this.providers) {
      const cached = this.healthCache.get(name);
      if (cached && Date.now() - cached.timestamp < this.healthCacheTTL) {
        results[name] = cached.status;
        continue;
      }
      
      try {
        const configured = !provider.isConfigured || provider.isConfigured();
        results[name] = {
          status: configured ? 'available' : 'not_configured',
          configured,
        };
        
        this.healthCache.set(name, {
          status: results[name],
          timestamp: Date.now(),
        });
      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message,
        };
      }
    }
    
    return results;
  }

  /**
   * Get provider count
   * @returns {number}
   */
  get count() {
    return this.providers.size;
  }
}

const providerManager = new ProviderManager();

module.exports = { 
  ProviderManager, 
  providerManager, 
  OpenAIProvider, 
  AnthropicProvider, 
  GeminiProvider,
  SUPPORTED_PROVIDERS,
  DEFAULT_PROVIDER,
};
