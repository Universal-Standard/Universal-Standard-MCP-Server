const logger = require('../utils/logger');
const { dynamicRegistry } = require('../evolution/registry');
const { evolutionOrchestrator } = require('../evolution/orchestrator');

class ToolRegistry {
  constructor() {
    this.builtinTools = new Map();
    this.autoEvolveEnabled = true;
  }

  async initialize() {
    await dynamicRegistry.initialize();
    logger.info('Tool registry initialized with dynamic tools');
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
      isBuiltin: true
    };

    this.builtinTools.set(tool.name, toolDef);
    logger.info(`Tool registered: ${tool.name}`);
    return this;
  }

  unregister(name) {
    if (this.builtinTools.delete(name)) {
      logger.info(`Tool unregistered: ${name}`);
      return true;
    }
    return false;
  }

  get(name) {
    if (this.builtinTools.has(name)) {
      return this.builtinTools.get(name);
    }
    
    if (dynamicRegistry.has(name)) {
      return dynamicRegistry.get(name);
    }
    
    return null;
  }

  has(name) {
    return this.builtinTools.has(name) || dynamicRegistry.has(name);
  }

  list() {
    const builtinList = Array.from(this.builtinTools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      category: tool.category,
      isBuiltin: true
    }));

    const generatedList = dynamicRegistry.list();

    return [...builtinList, ...generatedList];
  }

  async execute(name, args, context = {}) {
    if (this.builtinTools.has(name)) {
      const tool = this.builtinTools.get(name);
      logger.info(`Executing builtin tool: ${name}`, { args });
      
      try {
        const result = await tool.handler(args, context);
        logger.info(`Tool executed successfully: ${name}`);
        return result;
      } catch (error) {
        logger.error(`Tool execution failed: ${name}`, { error: error.message });
        throw error;
      }
    }

    if (dynamicRegistry.has(name)) {
      logger.info(`Executing generated tool: ${name}`, { args });
      return await dynamicRegistry.execute(name, args);
    }

    const shouldEvolve = context.autoEvolve !== false && this.autoEvolveEnabled;
    
    if (shouldEvolve) {
      logger.info(`Tool not found, triggering auto-evolution: ${name}`);
      return await this.evolveAndExecute(name, args, context);
    }

    throw new Error(`Tool not found: ${name}`);
  }

  async evolveAndExecute(name, args, context = {}) {
    try {
      const evolutionResult = await evolutionOrchestrator.evolve(name, {
        description: context.description
      });

      if (!evolutionResult.success) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Tool evolution failed',
              toolName: name,
              reason: evolutionResult.error,
              stage: evolutionResult.stage,
              suggestion: 'The requested tool could not be automatically created. Please try a different tool name or provide more context.'
            }, null, 2)
          }],
          isError: true
        };
      }

      await dynamicRegistry.registerTool(evolutionResult.tool);

      const result = await dynamicRegistry.execute(name, args);

      return {
        ...result,
        _evolution: {
          newTool: true,
          evolutionId: evolutionResult.evolutionId,
          duration: evolutionResult.duration
        }
      };
    } catch (error) {
      logger.error(`Auto-evolution failed: ${name}`, { error: error.message });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Tool evolution error',
            toolName: name,
            message: error.message
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  getByCategory(category) {
    const builtin = Array.from(this.builtinTools.values())
      .filter(tool => tool.category === category)
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        isBuiltin: true
      }));

    const generated = dynamicRegistry.list()
      .filter(tool => tool.category === category);

    return [...builtin, ...generated];
  }

  setAutoEvolve(enabled) {
    this.autoEvolveEnabled = enabled;
    logger.info(`Auto-evolution ${enabled ? 'enabled' : 'disabled'}`);
  }

  getStats() {
    const builtinCount = this.builtinTools.size;
    const dynamicStats = dynamicRegistry.getStats();

    return {
      builtin: builtinCount,
      generated: dynamicStats.total,
      total: builtinCount + dynamicStats.total,
      byCategory: {
        ...dynamicStats.byCategory
      },
      bySource: dynamicStats.bySource,
      autoEvolveEnabled: this.autoEvolveEnabled
    };
  }

  async reloadGeneratedTools() {
    await dynamicRegistry.reload();
  }
}

const registry = new ToolRegistry();

module.exports = { ToolRegistry, registry };
