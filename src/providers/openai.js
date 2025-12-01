const OpenAI = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

class OpenAIProvider {
  constructor() {
    this.client = new OpenAI({
      baseURL: config.ai.openai.baseURL,
      apiKey: config.ai.openai.apiKey,
    });
    this.name = 'openai';
  }

  async chat(messages, options = {}) {
    const model = options.model || config.ai.openai.defaultModel;
    
    logger.info('OpenAI chat request', { model, messageCount: messages.length });

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        max_completion_tokens: options.maxTokens || 8192,
        temperature: model.startsWith('gpt-5') ? undefined : options.temperature,
        stream: options.stream || false,
      });

      if (options.stream) {
        return response;
      }

      return {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage,
        model: response.model,
      };
    } catch (error) {
      logger.error('OpenAI chat error', { error: error.message });
      throw error;
    }
  }

  async *chatStream(messages, options = {}) {
    const model = options.model || config.ai.openai.defaultModel;
    
    const stream = await this.client.chat.completions.create({
      model,
      messages,
      max_completion_tokens: options.maxTokens || 8192,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  }

  async generateImage(prompt, options = {}) {
    const response = await this.client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: options.size || '1024x1024',
    });

    return {
      b64_json: response.data[0]?.b64_json,
    };
  }
}

OpenAIProvider.prototype.isConfigured = function() {
  return !!(this.client && config.ai.openai.baseURL);
};

module.exports = { OpenAIProvider };
