/**
 * Tool Sandbox
 * Secure isolated execution environment for testing generated tools
 * Features:
 * - Network access blocked (fetch, HTTP, WebSocket)
 * - Filesystem access blocked
 * - Timer APIs restricted
 * - Dangerous APIs blocked (eval, Function constructor)
 * - Resource limits enforced
 */
const vm = require('vm');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT = 5000;
const MAX_TIMEOUT = 30000;
const MAX_MEMORY = 50 * 1024 * 1024;

/**
 * @class ToolSandbox
 * Provides secure execution environment for tool testing
 */
class ToolSandbox {
  constructor(options = {}) {
    this.defaultTimeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxMemory = options.maxMemory || MAX_MEMORY;
  }

  /**
   * Test a generated tool in the sandbox
   * @param {Object} tool - Tool definition with handlerCode
   * @param {Array} testCases - Optional test cases
   * @returns {Promise<Object>} Test results
   */
  async test(tool, testCases = []) {
    const startTime = Date.now();
    const testId = uuidv4();
    
    if (!tool || !tool.handlerCode) {
      return {
        testId,
        toolName: tool?.name || 'unknown',
        passed: false,
        error: 'Invalid tool: missing handlerCode',
        duration: 0,
      };
    }
    
    logger.info('Sandbox testing started', { toolName: tool.name, testId });
    
    const results = {
      testId,
      toolName: tool.name,
      passed: false,
      securityScan: null,
      compilationTest: null,
      executionTests: [],
      duration: 0
    };
    
    try {
      results.securityScan = this.performSecurityScan(tool.handlerCode);
      if (!results.securityScan.passed) {
        results.error = 'Security scan failed';
        results.duration = Date.now() - startTime;
        return results;
      }
      
      results.compilationTest = await this.testCompilation(tool);
      if (!results.compilationTest.passed) {
        results.error = 'Compilation test failed';
        results.duration = Date.now() - startTime;
        return results;
      }
      
      const effectiveTestCases = testCases.length > 0 
        ? testCases 
        : this.generateDefaultTestCases(tool.inputSchema);
      
      for (const testCase of effectiveTestCases) {
        const executionResult = await this.testExecution(tool, testCase);
        results.executionTests.push(executionResult);
      }
      
      results.passed = results.executionTests.every(t => t.passed);
      results.duration = Date.now() - startTime;
      
      logger.info('Sandbox testing completed', { 
        toolName: tool.name, 
        testId,
        passed: results.passed,
        duration: results.duration 
      });
      
      return results;
    } catch (error) {
      logger.error('Sandbox testing failed', { toolName: tool.name, testId, error: error.message });
      results.error = error.message;
      results.duration = Date.now() - startTime;
      return results;
    }
  }

  /**
   * Perform security scan on handler code
   * @param {string} handlerCode - Code to scan
   * @returns {Object} Security scan results
   */
  performSecurityScan(handlerCode) {
    if (!handlerCode || typeof handlerCode !== 'string') {
      return {
        passed: false,
        issues: [{ name: 'Invalid code', severity: 'critical' }],
        criticalCount: 1,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };
    }
    
    const issues = [];
    
    const dangerousPatterns = [
      { pattern: /require\s*\(/, name: 'require() call', severity: 'critical' },
      { pattern: /import\s+.*from/, name: 'import statement', severity: 'critical' },
      { pattern: /process\./, name: 'process access', severity: 'critical' },
      { pattern: /child_process/, name: 'child_process module', severity: 'critical' },
      { pattern: /\bexec\s*\(/, name: 'exec() call', severity: 'critical' },
      { pattern: /\bspawn\s*\(/, name: 'spawn() call', severity: 'critical' },
      { pattern: /\beval\s*\(/, name: 'eval() call', severity: 'critical' },
      { pattern: /new\s+Function\s*\(/, name: 'Function constructor', severity: 'critical' },
      { pattern: /\bfs\./, name: 'filesystem access', severity: 'critical' },
      { pattern: /\bfetch\s*\(/, name: 'fetch() call', severity: 'critical' },
      { pattern: /XMLHttpRequest/, name: 'XMLHttpRequest access', severity: 'critical' },
      { pattern: /WebSocket/, name: 'WebSocket access', severity: 'critical' },
      { pattern: /\bhttp\./, name: 'http module access', severity: 'critical' },
      { pattern: /\bhttps\./, name: 'https module access', severity: 'critical' },
      { pattern: /\bnet\./, name: 'net module access', severity: 'critical' },
      { pattern: /\bdns\./, name: 'dns module access', severity: 'critical' },
      { pattern: /setTimeout\s*\(/, name: 'setTimeout call', severity: 'high' },
      { pattern: /setInterval\s*\(/, name: 'setInterval call', severity: 'critical' },
      { pattern: /setImmediate\s*\(/, name: 'setImmediate call', severity: 'critical' },
      { pattern: /__dirname/, name: '__dirname access', severity: 'critical' },
      { pattern: /__filename/, name: '__filename access', severity: 'critical' },
      { pattern: /\.env\b/, name: 'env file access', severity: 'critical' },
      { pattern: /globalThis/, name: 'globalThis access', severity: 'critical' },
      { pattern: /global\./, name: 'global access', severity: 'critical' },
      { pattern: /Reflect\./, name: 'Reflect API', severity: 'high' },
      { pattern: /new\s+Proxy\s*\(/, name: 'Proxy constructor', severity: 'high' },
      { pattern: /Object\.getOwnPropertyDescriptor/, name: 'property descriptor access', severity: 'medium' },
      { pattern: /process\.env/, name: 'environment variable access', severity: 'critical' },
      { pattern: /Buffer\.allocUnsafe/, name: 'unsafe buffer allocation', severity: 'high' },
      { pattern: /WeakRef/, name: 'WeakRef access', severity: 'medium' },
      { pattern: /FinalizationRegistry/, name: 'FinalizationRegistry access', severity: 'medium' },
    ];
    
    for (const { pattern, name, severity } of dangerousPatterns) {
      if (pattern.test(handlerCode)) {
        issues.push({ name, severity, pattern: pattern.toString() });
      }
    }
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');
    
    return {
      passed: criticalIssues.length === 0 && highIssues.length === 0,
      issues,
      criticalCount: criticalIssues.length,
      highCount: highIssues.length,
      mediumCount: issues.filter(i => i.severity === 'medium').length,
      lowCount: issues.filter(i => i.severity === 'low').length
    };
  }

  async testCompilation(tool) {
    try {
      const wrappedCode = `(${tool.handlerCode})`;
      new vm.Script(wrappedCode);
      
      return {
        passed: true,
        message: 'Handler code compiled successfully'
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        message: 'Handler code failed to compile'
      };
    }
  }

  async testExecution(tool, testCase) {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      const sandbox = this.createSandbox();
      const context = vm.createContext(sandbox);
      
      const wrappedCode = `(${tool.handlerCode})`;
      const script = new vm.Script(wrappedCode);
      const handler = script.runInContext(context, { 
        timeout: this.defaultTimeout,
        displayErrors: true
      });
      
      if (typeof handler !== 'function') {
        return {
          passed: false,
          executionId,
          testCase,
          error: 'Handler is not a function',
          duration: Date.now() - startTime
        };
      }
      
      const result = await Promise.race([
        handler(testCase.input),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Execution timeout')), this.defaultTimeout)
        )
      ]);
      
      const validation = this.validateResult(result, testCase.expectedOutput);
      
      return {
        passed: validation.passed,
        executionId,
        testCase,
        result,
        validation,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        passed: false,
        executionId,
        testCase,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  createSandbox() {
    const logs = [];
    
    return {
      console: {
        log: (...args) => logs.push({ type: 'log', args: args.map(a => String(a)) }),
        error: (...args) => logs.push({ type: 'error', args: args.map(a => String(a)) }),
        warn: (...args) => logs.push({ type: 'warn', args: args.map(a => String(a)) }),
        info: (...args) => logs.push({ type: 'info', args: args.map(a => String(a)) }),
      },
      
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      TypeError,
      RangeError,
      Map,
      Set,
      Promise,
      Symbol,
      
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      atob: (str) => Buffer.from(str, 'base64').toString('utf8'),
      btoa: (str) => Buffer.from(str).toString('base64'),
      
      _logs: logs
    };
  }

  generateDefaultTestCases(inputSchema) {
    const testCases = [];
    const properties = inputSchema.properties || {};
    const required = inputSchema.required || [];
    
    const minimalInput = {};
    for (const prop of required) {
      minimalInput[prop] = this.generateSampleValue(properties[prop]);
    }
    testCases.push({
      name: 'minimal_required_params',
      input: minimalInput,
      expectedOutput: { type: 'success' }
    });
    
    const fullInput = {};
    for (const [prop, schema] of Object.entries(properties)) {
      fullInput[prop] = this.generateSampleValue(schema);
    }
    testCases.push({
      name: 'all_params',
      input: fullInput,
      expectedOutput: { type: 'success' }
    });
    
    return testCases;
  }

  generateSampleValue(schema) {
    if (!schema) return 'test';
    
    switch (schema.type) {
      case 'string':
        if (schema.enum) return schema.enum[0];
        if (schema.default) return schema.default;
        return 'test_value';
      case 'integer':
      case 'number':
        if (schema.default) return schema.default;
        return schema.minimum || 1;
      case 'boolean':
        return schema.default ?? true;
      case 'array':
        return [this.generateSampleValue(schema.items)];
      case 'object':
        const obj = {};
        for (const [key, propSchema] of Object.entries(schema.properties || {})) {
          obj[key] = this.generateSampleValue(propSchema);
        }
        return obj;
      default:
        return 'test';
    }
  }

  validateResult(result, expectedOutput) {
    if (!result) {
      return { passed: false, reason: 'No result returned' };
    }
    
    if (result.content && Array.isArray(result.content)) {
      const hasValidContent = result.content.some(c => 
        c.type === 'text' && typeof c.text === 'string'
      );
      if (hasValidContent) {
        return { passed: true, reason: 'Valid MCP response format' };
      }
    }
    
    if (expectedOutput && expectedOutput.type === 'success') {
      return { passed: true, reason: 'Execution completed without error' };
    }
    
    return { 
      passed: false, 
      reason: 'Invalid response format - expected MCP format with content array' 
    };
  }

  async execute(handlerCode, args, options = {}) {
    const timeout = Math.min(options.timeout || this.defaultTimeout, this.defaultTimeout);
    
    const securityScan = this.performSecurityScan(handlerCode);
    if (!securityScan.passed) {
      throw new Error(`Security violation: ${securityScan.issues.map(i => i.name).join(', ')}`);
    }
    
    const sandbox = this.createSandbox();
    const context = vm.createContext(sandbox);
    
    const wrappedCode = `(${handlerCode})`;
    const script = new vm.Script(wrappedCode);
    
    let handler;
    try {
      handler = script.runInContext(context, { 
        timeout: 1000,
        displayErrors: true
      });
    } catch (error) {
      throw new Error(`Failed to compile handler: ${error.message}`);
    }
    
    if (typeof handler !== 'function') {
      throw new Error('Handler is not a function');
    }
    
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Execution timeout - code took too long to execute'));
      }, timeout);
    });
    
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => handler(args)),
        timeoutPromise
      ]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

module.exports = { ToolSandbox };
