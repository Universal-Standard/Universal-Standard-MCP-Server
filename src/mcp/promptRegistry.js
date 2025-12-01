const logger = require('../utils/logger');

class PromptRegistry {
  constructor() {
    this.prompts = new Map();
  }

  register(prompt) {
    if (!prompt.name) {
      throw new Error('Prompt must have a name');
    }

    const promptDef = {
      name: prompt.name,
      description: prompt.description || '',
      arguments: prompt.arguments || [],
      template: prompt.template || '',
    };

    this.prompts.set(prompt.name, promptDef);
    logger.info(`Prompt registered: ${prompt.name}`);
    return this;
  }

  get(name) {
    return this.prompts.get(name);
  }

  list() {
    return Array.from(this.prompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }));
  }

  render(name, args = {}) {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    let rendered = prompt.template;
    for (const [key, value] of Object.entries(args)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    return {
      messages: [{ role: 'user', content: rendered }],
    };
  }
}

const promptRegistry = new PromptRegistry();

promptRegistry.register({
  name: 'summarize',
  description: 'Summarize the given text',
  arguments: [
    { name: 'text', description: 'Text to summarize', required: true },
    { name: 'length', description: 'Summary length (short/medium/long)', required: false },
  ],
  template: 'Please summarize the following text in a {{length}} format:\n\n{{text}}',
});

promptRegistry.register({
  name: 'analyze_code',
  description: 'Analyze code for issues and improvements',
  arguments: [
    { name: 'code', description: 'Code to analyze', required: true },
    { name: 'language', description: 'Programming language', required: false },
  ],
  template: 'Analyze the following {{language}} code for bugs, security issues, and potential improvements:\n\n```{{language}}\n{{code}}\n```',
});

promptRegistry.register({
  name: 'translate',
  description: 'Translate text to another language',
  arguments: [
    { name: 'text', description: 'Text to translate', required: true },
    { name: 'target_language', description: 'Target language', required: true },
  ],
  template: 'Translate the following text to {{target_language}}:\n\n{{text}}',
});

module.exports = { PromptRegistry, promptRegistry };
