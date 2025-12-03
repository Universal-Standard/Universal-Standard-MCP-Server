const config = require('../config');
const logger = require('../utils/logger');

class AnthropicProvider {
  constructor() {
    this.apiKey = config.ai.anthropic.apiKey;
    this.name = 'anthropic';
    this.baseURL = 'https://api.anthropic.com/v1';
  }
  
  isConfigured() {
    return !!this.apiKey;
  }

  async chat(messages, options = {}) {
    if (!this.isConfigured()) {
      const error = new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
      error.statusCode = 503;
      throw error;
    }

    const model = options.model || config.ai.anthropic.defaultModel;
    
    logger.info('Anthropic chat request', { model, messageCount: messages.length });

    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 8192,
          system: systemMessage?.content,
          messages: chatMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Anthropic API error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {}
        const error = new Error(errorMessage);
        error.statusCode = response.status;
        throw error;
      }

      const data = await response.json();

      return {
        content: data.content[0]?.text || '',
        usage: {
          prompt_tokens: data.usage?.input_tokens,
          completion_tokens: data.usage?.output_tokens,
        },
        model: data.model,
      };
    } catch (error) {
      logger.error('Anthropic chat error', { error: error.message });
      throw error;
    }
  }

  async *chatStream(messages, options = {}) {
    if (!this.isConfigured()) {
      const error = new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
      error.statusCode = 503;
      throw error;
    }

    const model = options.model || config.ai.anthropic.defaultModel;
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 8192,
        system: systemMessage?.content,
        messages: chatMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Anthropic API error';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {}
      const error = new Error(errorMessage);
      error.statusCode = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content_block_delta' && data.delta?.text) {
            yield data.delta.text;
          }
        } catch (e) {
        }
      }
    }
  }

  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = { AnthropicProvider };
