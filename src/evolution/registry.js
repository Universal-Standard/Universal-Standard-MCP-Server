const vm = require('vm');
const logger = require('../utils/logger');
const { storage } = require('../../server/storage');
const { ToolSandbox } = require('./sandbox');

class DynamicToolRegistry {
  constructor() {
    this.generatedTools = new Map();
    this.sandbox = new ToolSandbox();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    logger.info('Initializing dynamic tool registry');
    
    try {
      await this.loadGeneratedTools();
      this.initialized = true;
      logger.info('Dynamic tool registry initialized', { 
        toolCount: this.generatedTools.size 
      });
    } catch (error) {
      logger.error('Failed to initialize dynamic tool registry', { error: error.message });
    }
  }

  async loadGeneratedTools() {
    try {
      const tools = await storage.getGeneratedTools('active');
      
      for (const tool of tools) {
        try {
          const handler = this.compileHandler(tool.handlerCode);
          
          this.generatedTools.set(tool.name, {
            id: tool.id,
            name: tool.name,
            description: tool.description,
            category: tool.category,
            inputSchema: tool.inputSchema,
            handler,
            handlerCode: tool.handlerCode,
            sourceType: tool.sourceType,
            sourceUrl: tool.sourceUrl,
            version: tool.version,
            usageCount: tool.usageCount,
            createdAt: tool.createdAt,
            isGenerated: true
          });
          
          logger.info('Loaded generated tool', { name: tool.name });
        } catch (error) {
          logger.warn('Failed to load generated tool', { name: tool.name, error: error.message });
        }
      }
    } catch (error) {
      logger.error('Failed to load generated tools from database', { error: error.message });
    }
  }

  compileHandler(handlerCode) {
    const sandbox = this.sandbox.createSandbox();
    const context = vm.createContext(sandbox);
    
    const wrappedCode = `(${handlerCode})`;
    const script = new vm.Script(wrappedCode);
    const handler = script.runInContext(context, { displayErrors: true });
    
    if (typeof handler !== 'function') {
      throw new Error('Handler is not a function');
    }
    
    return async (args) => {
      return await this.sandbox.execute(handlerCode, args);
    };
  }

  async registerTool(toolData) {
    try {
      const handler = this.compileHandler(toolData.handlerCode);
      
      this.generatedTools.set(toolData.name, {
        id: toolData.id,
        name: toolData.name,
        description: toolData.description,
        category: toolData.category,
        inputSchema: toolData.inputSchema,
        handler,
        handlerCode: toolData.handlerCode,
        sourceType: toolData.sourceType,
        sourceUrl: toolData.sourceUrl,
        version: toolData.version || 1,
        usageCount: toolData.usageCount || 0,
        createdAt: toolData.createdAt || new Date(),
        isGenerated: true
      });
      
      logger.info('Registered generated tool', { name: toolData.name });
      return true;
    } catch (error) {
      logger.error('Failed to register generated tool', { name: toolData.name, error: error.message });
      return false;
    }
  }

  async unregisterTool(toolName) {
    if (this.generatedTools.has(toolName)) {
      this.generatedTools.delete(toolName);
      logger.info('Unregistered generated tool', { name: toolName });
      return true;
    }
    return false;
  }

  get(toolName) {
    return this.generatedTools.get(toolName);
  }

  has(toolName) {
    return this.generatedTools.has(toolName);
  }

  list() {
    return Array.from(this.generatedTools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      inputSchema: tool.inputSchema,
      isGenerated: true,
      sourceType: tool.sourceType,
      usageCount: tool.usageCount,
      version: tool.version
    }));
  }

  async execute(toolName, args) {
    const tool = this.generatedTools.get(toolName);
    
    if (!tool) {
      throw new Error(`Generated tool not found: ${toolName}`);
    }
    
    try {
      storage.incrementToolUsage(tool.id).catch(err => {
        logger.warn('Failed to increment tool usage', { name: toolName, error: err.message });
      });
      
      const result = await tool.handler(args);
      
      logger.info('Generated tool executed', { name: toolName });
      
      return result;
    } catch (error) {
      logger.error('Generated tool execution failed', { name: toolName, error: error.message });
      throw error;
    }
  }

  async reload() {
    this.generatedTools.clear();
    this.initialized = false;
    await this.initialize();
  }

  getStats() {
    const tools = Array.from(this.generatedTools.values());
    return {
      total: tools.length,
      byCategory: tools.reduce((acc, tool) => {
        acc[tool.category] = (acc[tool.category] || 0) + 1;
        return acc;
      }, {}),
      bySource: tools.reduce((acc, tool) => {
        acc[tool.sourceType] = (acc[tool.sourceType] || 0) + 1;
        return acc;
      }, {}),
      totalUsage: tools.reduce((sum, tool) => sum + (tool.usageCount || 0), 0)
    };
  }
}

const dynamicRegistry = new DynamicToolRegistry();

module.exports = { DynamicToolRegistry, dynamicRegistry };
