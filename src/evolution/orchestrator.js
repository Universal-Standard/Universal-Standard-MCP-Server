/**
 * Evolution Orchestrator
 * Coordinates the tool auto-evolution process:
 * Discovery -> Generation -> Testing -> Registration
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { storage } = require('../../server/storage');
const { GitHubDiscovery } = require('./discovery/github');
const { PostmanDiscovery } = require('./discovery/postman');
const { ToolGenerator } = require('./generator');
const { ToolSandbox } = require('./sandbox');

const MAX_CONCURRENT_EVOLUTIONS = 5;

/**
 * @class EvolutionOrchestrator
 * Manages the end-to-end tool evolution process
 */
class EvolutionOrchestrator {
  constructor() {
    this.githubDiscovery = new GitHubDiscovery();
    this.postmanDiscovery = new PostmanDiscovery();
    this.generator = new ToolGenerator();
    this.sandbox = new ToolSandbox();
    
    this.activeEvolutions = new Map();
  }

  /**
   * Evolve a new tool from discovered implementations
   * @param {string} toolName - Name of the tool to create
   * @param {Object} options - Evolution options
   * @param {string} options.description - Tool description for AI
   * @param {Array} options.examples - Example inputs/outputs
   * @param {string} options.category - Tool category
   * @returns {Promise<Object>} Evolution result
   */
  async evolve(toolName, options = {}) {
    const evolutionId = uuidv4();
    const startTime = Date.now();
    
    if (!toolName || typeof toolName !== 'string') {
      return {
        success: false,
        error: 'Tool name is required',
        evolutionId,
      };
    }
    
    const sanitizedName = toolName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    logger.info('Evolution started', { evolutionId, toolName: sanitizedName });
    
    if (this.activeEvolutions.has(sanitizedName)) {
      logger.warn('Evolution already in progress for tool', { toolName: sanitizedName });
      return {
        success: false,
        error: `Evolution already in progress for ${sanitizedName}`,
        evolutionId: this.activeEvolutions.get(sanitizedName),
      };
    }
    
    if (this.activeEvolutions.size >= MAX_CONCURRENT_EVOLUTIONS) {
      return {
        success: false,
        error: `Maximum concurrent evolutions (${MAX_CONCURRENT_EVOLUTIONS}) reached`,
        evolutionId,
      };
    }
    
    this.activeEvolutions.set(sanitizedName, evolutionId);
    
    try {
      await this.logStage(toolName, 'started', 'in_progress', { evolutionId, options });
      
      const discoveryResults = await this.runDiscovery(toolName, evolutionId, options);
      
      const generationResult = await this.runGeneration(toolName, evolutionId, discoveryResults, options);
      
      if (!generationResult.success) {
        await this.logStage(toolName, 'generation', 'failed', { error: generationResult.error });
        this.activeEvolutions.delete(toolName);
        return {
          success: false,
          evolutionId,
          stage: 'generation',
          error: generationResult.error,
          duration: Date.now() - startTime
        };
      }
      
      const testResults = await this.runTesting(toolName, evolutionId, generationResult.tool);
      
      if (!testResults.passed) {
        await this.logStage(toolName, 'testing', 'failed', { testResults });
        this.activeEvolutions.delete(toolName);
        return {
          success: false,
          evolutionId,
          stage: 'testing',
          error: 'Tool failed sandbox testing',
          testResults,
          duration: Date.now() - startTime
        };
      }
      
      const registeredTool = await this.runRegistration(toolName, evolutionId, generationResult, testResults);
      
      await this.logStage(toolName, 'completed', 'success', { 
        toolId: registeredTool.id,
        duration: Date.now() - startTime
      });
      
      this.activeEvolutions.delete(toolName);
      
      logger.info('Evolution completed successfully', { 
        evolutionId, 
        toolName,
        toolId: registeredTool.id,
        duration: Date.now() - startTime 
      });
      
      return {
        success: true,
        evolutionId,
        tool: registeredTool,
        stages: {
          discovery: discoveryResults,
          generation: generationResult,
          testing: testResults
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Evolution failed', { evolutionId, toolName, error: error.message });
      
      await this.logStage(toolName, 'error', 'failed', { error: error.message });
      
      this.activeEvolutions.delete(toolName);
      
      return {
        success: false,
        evolutionId,
        stage: 'unknown',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async runDiscovery(toolName, evolutionId, options) {
    const startTime = Date.now();
    
    await this.logStage(toolName, 'discovery', 'in_progress', { evolutionId });
    
    const [githubResults, postmanResults] = await Promise.all([
      this.githubDiscovery.search(toolName, options),
      this.postmanDiscovery.search(toolName, options)
    ]);
    
    const results = [githubResults, postmanResults];
    const totalResults = results.reduce((sum, r) => sum + (r.results?.length || 0), 0);
    
    await this.logStage(toolName, 'discovery', 'completed', {
      evolutionId,
      githubResults: githubResults.results?.length || 0,
      postmanResults: postmanResults.results?.length || 0,
      duration: Date.now() - startTime
    });
    
    return results;
  }

  async runGeneration(toolName, evolutionId, discoveryResults, options) {
    const startTime = Date.now();
    
    await this.logStage(toolName, 'generation', 'in_progress', { evolutionId });
    
    const result = await this.generator.generate(toolName, discoveryResults, options);
    
    await this.logStage(
      toolName, 
      'generation', 
      result.success ? 'completed' : 'failed', 
      {
        evolutionId,
        duration: Date.now() - startTime,
        error: result.error
      },
      result.aiPromptUsed,
      result.aiResponse
    );
    
    return result;
  }

  async runTesting(toolName, evolutionId, tool) {
    const startTime = Date.now();
    
    await this.logStage(toolName, 'testing', 'in_progress', { evolutionId });
    
    const results = await this.sandbox.test(tool);
    
    await this.logStage(
      toolName, 
      'testing', 
      results.passed ? 'completed' : 'failed', 
      {
        evolutionId,
        passed: results.passed,
        securityScan: results.securityScan,
        executionTests: results.executionTests?.length || 0,
        duration: Date.now() - startTime
      }
    );
    
    return results;
  }

  async runRegistration(toolName, evolutionId, generationResult, testResults) {
    const startTime = Date.now();
    
    await this.logStage(toolName, 'registration', 'in_progress', { evolutionId });
    
    const tool = generationResult.tool;
    const bestSource = generationResult.analysis?.bestMatch;
    
    const registeredTool = await storage.createGeneratedTool({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      inputSchema: tool.inputSchema,
      handlerCode: tool.handlerCode,
      sourceType: bestSource ? bestSource.source : 'ai-generated',
      sourceUrl: bestSource?.url || null,
      sourceData: {
        discoveryReferences: generationResult.analysis?.references?.slice(0, 3) || [],
        evolutionId
      },
      status: 'active',
      testResults: {
        testId: testResults.testId,
        passed: testResults.passed,
        securityScan: testResults.securityScan,
        executionTestsCount: testResults.executionTests?.length || 0
      },
      securityScan: testResults.securityScan
    });
    
    await this.logStage(toolName, 'registration', 'completed', {
      evolutionId,
      toolId: registeredTool.id,
      duration: Date.now() - startTime
    }, null, null, Date.now() - startTime, registeredTool.id);
    
    return registeredTool;
  }

  async logStage(toolName, stage, status, details = {}, aiPromptUsed = null, aiResponse = null, duration = null, toolId = null) {
    try {
      await storage.logToolCreation(
        toolName,
        stage,
        status,
        details,
        aiPromptUsed,
        aiResponse,
        duration,
        toolId
      );
    } catch (error) {
      logger.warn('Failed to log evolution stage', { toolName, stage, error: error.message });
    }
  }

  isEvolutionInProgress(toolName) {
    return this.activeEvolutions.has(toolName);
  }

  getActiveEvolutions() {
    return Array.from(this.activeEvolutions.entries()).map(([name, id]) => ({
      toolName: name,
      evolutionId: id
    }));
  }
}

const evolutionOrchestrator = new EvolutionOrchestrator();

module.exports = { EvolutionOrchestrator, evolutionOrchestrator };
