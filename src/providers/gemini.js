const config = require('../config');
const logger = require('../utils/logger');

class GeminiProvider {
  constructor() {
    this.apiKey = config.ai.gemini.apiKey;
    this.name = 'gemini';
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
  }
  
  isConfigured() {
    return !!this.apiKey;
  }

  async chat(messages, options = {}) {
    if (!this.isConfigured()) {
      const error = new Error('Google Gemini API key not configured. Set GOOGLE_API_KEY environment variable.');
      error.statusCode = 503;
      throw error;
    }

    const model = options.model || config.ai.gemini.defaultModel;
    
    logger.info('Gemini chat request', { model, messageCount: messages.length });

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    try {
      const response = await fetch(
        `${this.baseURL}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: {
              maxOutputTokens: options.maxTokens || 8192,
              temperature: options.temperature,
            },
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Gemini API error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {}
        const error = new Error(errorMessage);
        error.statusCode = response.status;
        throw error;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        content: text,
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount,
          completion_tokens: data.usageMetadata?.candidatesTokenCount,
        },
        model,
      };
    } catch (error) {
      logger.error('Gemini chat error', { error: error.message });
      throw error;
    }
  }

  async *chatStream(messages, options = {}) {
    if (!this.isConfigured()) {
      const error = new Error('Google Gemini API key not configured. Set GOOGLE_API_KEY environment variable.');
      error.statusCode = 503;
      throw error;
    }

    const model = options.model || config.ai.gemini.defaultModel;
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `${this.baseURL}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            maxOutputTokens: options.maxTokens || 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      let errorMessage = 'Gemini API error';
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
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield text;
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

module.exports = { GeminiProvider };
