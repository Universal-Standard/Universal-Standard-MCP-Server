const logger = require('../utils/logger');
const { providerManager } = require('../providers');

class ToolGenerator {
  constructor() {
    this.maxRetries = 3;
  }

  async generate(toolName, discoveryResults, options = {}) {
    const startTime = Date.now();
    
    logger.info('Tool generation started', { toolName });
    
    try {
      const analysisResult = await this.analyzeDiscoveryResults(toolName, discoveryResults);
      
      if (!analysisResult.canGenerate) {
        return {
          success: false,
          toolName,
          error: analysisResult.reason,
          duration: Date.now() - startTime
        };
      }
      
      const generatedCode = await this.generateToolCode(toolName, analysisResult, options);
      
      if (!generatedCode.success) {
        return {
          success: false,
          toolName,
          error: generatedCode.error,
          duration: Date.now() - startTime
        };
      }
      
      logger.info('Tool generation completed', { 
        toolName, 
        duration: Date.now() - startTime 
      });
      
      return {
        success: true,
        toolName,
        tool: generatedCode.tool,
        analysis: analysisResult,
        aiPromptUsed: generatedCode.prompt,
        aiResponse: generatedCode.response,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Tool generation failed', { toolName, error: error.message });
      return {
        success: false,
        toolName,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async analyzeDiscoveryResults(toolName, discoveryResults) {
    const allResults = [];
    
    for (const discovery of discoveryResults) {
      if (discovery.results && discovery.results.length > 0) {
        allResults.push(...discovery.results.map(r => ({
          ...r,
          source: discovery.source
        })));
      }
    }
    
    if (allResults.length === 0) {
      return {
        canGenerate: true,
        reason: 'No existing implementations found, will generate from scratch',
        references: [],
        suggestedApproach: 'ai-generated'
      };
    }
    
    const sortedResults = allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topResults = sortedResults.slice(0, 3);
    
    return {
      canGenerate: true,
      references: topResults,
      suggestedApproach: topResults[0].toolImplementation ? 'adapt-existing' : 'ai-generated',
      bestMatch: topResults[0]
    };
  }

  async generateToolCode(toolName, analysis, options = {}) {
    const prompt = this.buildGenerationPrompt(toolName, analysis, options);
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await providerManager.chat([
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ], {
          provider: 'openai',
          maxTokens: 4000
        });
        
        const parsedTool = this.parseGeneratedTool(response.content, toolName);
        
        if (parsedTool.success) {
          return {
            success: true,
            tool: parsedTool.tool,
            prompt,
            response: response.content
          };
        }
        
        lastError = parsedTool.error;
        logger.warn('Failed to parse generated tool, retrying', { attempt, error: lastError });
      } catch (error) {
        lastError = error.message;
        logger.warn('Tool generation attempt failed', { attempt, error: error.message });
      }
    }
    
    return {
      success: false,
      error: `Failed after ${this.maxRetries} attempts: ${lastError}`
    };
  }

  getSystemPrompt() {
    return `You are an expert MCP (Model Context Protocol) tool generator. Your task is to create fully functional, secure, and well-tested tool implementations.

IMPORTANT RULES:
1. Generate ONLY the JSON tool definition with handler code as a string
2. The handler must be a valid JavaScript async function that can be evaluated
3. Include proper error handling in all generated code
4. Never include any code that could be harmful or access sensitive data
5. Use only safe, built-in JavaScript features and fetch API for HTTP requests
6. Include comprehensive input validation
7. Return results in the MCP format: { content: [{ type: 'text', text: '...' }] }

OUTPUT FORMAT (must be valid JSON):
{
  "name": "tool_name",
  "description": "Clear description of what the tool does",
  "category": "category_name",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": { "type": "string", "description": "Parameter description" }
    },
    "required": ["param1"]
  },
  "handlerCode": "async (args) => { /* implementation */ return { content: [{ type: 'text', text: JSON.stringify(result) }] }; }"
}`;
  }

  buildGenerationPrompt(toolName, analysis, options) {
    let prompt = `Generate an MCP tool called "${toolName}".\n\n`;
    
    if (options.description) {
      prompt += `Description from user: ${options.description}\n\n`;
    }
    
    if (analysis.references && analysis.references.length > 0) {
      prompt += `Reference implementations found:\n`;
      for (const ref of analysis.references) {
        prompt += `- ${ref.name} (${ref.source}): ${ref.description || 'No description'}\n`;
        if (ref.toolImplementation) {
          prompt += `  Code snippet: ${ref.toolImplementation.match?.slice(0, 200)}...\n`;
        }
        if (ref.apiSpec) {
          prompt += `  API: ${JSON.stringify(ref.apiSpec).slice(0, 200)}...\n`;
        }
      }
      prompt += '\n';
    }
    
    prompt += `Requirements:
1. The tool should be practical and useful
2. Include proper parameter validation
3. Handle errors gracefully
4. If making HTTP requests, use the fetch API
5. Return results in proper MCP format

Generate the complete tool definition as JSON.`;
    
    return prompt;
  }

  parseGeneratedTool(responseContent, expectedName) {
    try {
      let jsonStr = responseContent;
      
      const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        const startIdx = responseContent.indexOf('{');
        const endIdx = responseContent.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = responseContent.slice(startIdx, endIdx + 1);
        }
      }
      
      const tool = JSON.parse(jsonStr);
      
      if (!tool.name || !tool.description || !tool.inputSchema || !tool.handlerCode) {
        return {
          success: false,
          error: 'Missing required fields in generated tool'
        };
      }
      
      const securityCheck = this.validateHandlerSecurity(tool.handlerCode);
      if (!securityCheck.safe) {
        return {
          success: false,
          error: `Security validation failed: ${securityCheck.reason}`
        };
      }
      
      return {
        success: true,
        tool: {
          name: tool.name,
          description: tool.description,
          category: tool.category || 'generated',
          inputSchema: tool.inputSchema,
          handlerCode: tool.handlerCode
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse generated tool: ${error.message}`
      };
    }
  }

  validateHandlerSecurity(handlerCode) {
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /process\./,
      /child_process/,
      /exec\s*\(/,
      /spawn\s*\(/,
      /eval\s*\(/,
      /Function\s*\(/,
      /fs\./,
      /__dirname/,
      /__filename/,
      /\.env/,
      /globalThis/,
      /Reflect\./,
      /Proxy/
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(handlerCode)) {
        return {
          safe: false,
          reason: `Dangerous pattern detected: ${pattern.toString()}`
        };
      }
    }
    
    return { safe: true };
  }
}

module.exports = { ToolGenerator };
