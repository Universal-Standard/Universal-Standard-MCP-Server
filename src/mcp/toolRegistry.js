const logger = require('../utils/logger');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    if (!tool.name || !tool.handler) {
      throw new Error('Tool must have a name and handler');
    }

    const toolDef = {
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      handler: tool.handler,
      category: tool.category || 'general',
      requiresAuth: tool.requiresAuth !== false,
    };

    this.tools.set(tool.name, toolDef);
    logger.info(`Tool registered: ${tool.name}`);
    return this;
  }

  unregister(name) {
    if (this.tools.delete(name)) {
      logger.info(`Tool unregistered: ${name}`);
      return true;
    }
    return false;
  }

  get(name) {
    return this.tools.get(name);
  }

  list() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      category: tool.category,
    }));
  }

  async execute(name, args, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    logger.info(`Executing tool: ${name}`, { args });
    
    try {
      const result = await tool.handler(args, context);
      logger.info(`Tool executed successfully: ${name}`);
      return result;
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, { error: error.message });
      throw error;
    }
  }

  getByCategory(category) {
    return Array.from(this.tools.values())
      .filter(tool => tool.category === category)
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
  }
}

const registry = new ToolRegistry();

module.exports = { ToolRegistry, registry };
