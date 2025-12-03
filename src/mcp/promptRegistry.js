/**
 * Prompt Registry
 * Manages prompt templates for AI interactions
 */
const logger = require('../utils/logger');

/**
 * Validate prompt argument definition
 * @param {Object} arg - Argument definition
 * @returns {Object} Validated argument
 */
function validateArgument(arg) {
  if (!arg.name || typeof arg.name !== 'string') {
    throw new Error('Argument must have a name');
  }
  
  return {
    name: arg.name,
    description: arg.description || '',
    required: arg.required !== false,
    default: arg.default,
  };
}

/**
 * @class PromptRegistry
 * Manages registration and rendering of prompt templates
 */
class PromptRegistry {
  constructor() {
    this.prompts = new Map();
  }

  /**
   * Register a new prompt template
   * @param {Object} prompt - Prompt definition
   * @param {string} prompt.name - Unique prompt name
   * @param {string} prompt.description - Prompt description
   * @param {Array} prompt.arguments - Prompt arguments
   * @param {string} prompt.template - Prompt template with {{placeholders}}
   * @returns {PromptRegistry} this for chaining
   */
  register(prompt) {
    if (!prompt.name || typeof prompt.name !== 'string') {
      throw new Error('Prompt must have a valid name');
    }
    
    if (!prompt.template || typeof prompt.template !== 'string') {
      throw new Error('Prompt must have a template');
    }

    const promptDef = {
      name: prompt.name.trim(),
      description: prompt.description || '',
      arguments: (prompt.arguments || []).map(validateArgument),
      template: prompt.template,
    };

    this.prompts.set(prompt.name, promptDef);
    logger.info(`Prompt registered: ${prompt.name}`);
    return this;
  }

  /**
   * Get a prompt by name
   * @param {string} name - Prompt name
   * @returns {Object|undefined} Prompt definition
   */
  get(name) {
    return this.prompts.get(name);
  }

  /**
   * Check if prompt exists
   * @param {string} name - Prompt name
   * @returns {boolean}
   */
  has(name) {
    return this.prompts.has(name);
  }

  /**
   * List all registered prompts
   * @returns {Array} List of prompt definitions
   */
  list() {
    return Array.from(this.prompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }));
  }

  /**
   * Render a prompt with provided arguments
   * @param {string} name - Prompt name
   * @param {Object} args - Arguments to substitute
   * @returns {Object} Rendered prompt with messages array
   * @throws {Error} If prompt not found or required arguments missing
   */
  render(name, args = {}) {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    const missingRequired = prompt.arguments
      .filter(arg => arg.required && !(arg.name in args) && arg.default === undefined)
      .map(arg => arg.name);
    
    if (missingRequired.length > 0) {
      throw new Error(`Missing required arguments: ${missingRequired.join(', ')}`);
    }

    const resolvedArgs = {};
    for (const arg of prompt.arguments) {
      resolvedArgs[arg.name] = args[arg.name] ?? arg.default ?? '';
    }

    let rendered = prompt.template;
    for (const [key, value] of Object.entries(resolvedArgs)) {
      const safeValue = String(value);
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), safeValue);
    }
    
    const unresolvedPlaceholders = rendered.match(/{{[^}]+}}/g);
    if (unresolvedPlaceholders) {
      logger.warn('Unresolved placeholders in prompt', { 
        prompt: name, 
        placeholders: unresolvedPlaceholders 
      });
    }
    
    return {
      messages: [{ role: 'user', content: rendered }],
    };
  }

  /**
   * Get count of registered prompts
   * @returns {number}
   */
  get count() {
    return this.prompts.size;
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
