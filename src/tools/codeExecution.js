/**
 * Code Execution Tool
 * Provides sandboxed JavaScript code execution
 */
const { registry } = require('../mcp/toolRegistry');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const vm = require('vm');

const DEFAULT_TIMEOUT = 5000;
const MAX_TIMEOUT = 30000;
const MIN_TIMEOUT = 100;
const MAX_CODE_LENGTH = 100000;
const MAX_LOG_ENTRIES = 100;

/**
 * Create a sandboxed execution context
 * @param {Array} logs - Array to collect console output
 * @returns {Object} Sandbox object with safe globals
 */
function createSandbox(logs) {
  const safeLog = (type) => (...args) => {
    if (logs.length < MAX_LOG_ENTRIES) {
      logs.push({
        type,
        args: args.map(arg => {
          try {
            return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
          } catch {
            return '[Unserializable]';
          }
        }),
        timestamp: Date.now(),
      });
    }
  };

  return {
    console: {
      log: safeLog('log'),
      error: safeLog('error'),
      warn: safeLog('warn'),
      info: safeLog('info'),
      debug: safeLog('debug'),
    },
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    Map,
    Set,
    WeakMap,
    WeakSet,
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
  };
}

/**
 * Format execution result for output
 * @param {*} result - Execution result
 * @returns {string} Formatted result
 */
function formatResult(result) {
  if (result === undefined) return undefined;
  if (result === null) return 'null';
  
  try {
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  } catch {
    return '[Unserializable result]';
  }
}

registry.register({
  name: 'code_sandbox',
  description: 'Execute JavaScript code in a secure sandboxed environment. No network access or file system access allowed.',
  category: 'code',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code to execute',
        maxLength: MAX_CODE_LENGTH,
      },
      timeout: {
        type: 'integer',
        description: `Execution timeout in milliseconds (${MIN_TIMEOUT}-${MAX_TIMEOUT})`,
        default: DEFAULT_TIMEOUT,
        minimum: MIN_TIMEOUT,
        maximum: MAX_TIMEOUT,
      },
    },
    required: ['code'],
  },
  handler: async (args, context) => {
    const { code } = args;
    const timeout = Math.max(MIN_TIMEOUT, Math.min(parseInt(args.timeout) || DEFAULT_TIMEOUT, MAX_TIMEOUT));
    const executionId = uuidv4();
    const startTime = Date.now();
    
    if (!code || typeof code !== 'string') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executionId,
            success: false,
            error: 'Code is required',
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    if (code.length > MAX_CODE_LENGTH) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executionId,
            success: false,
            error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`,
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    logger.info('Code execution requested', { 
      executionId,
      codeLength: code.length,
      timeout,
      userId: context?.user?.id,
    });
    
    const logs = [];
    
    try {
      const sandbox = createSandbox(logs);
      const vmContext = vm.createContext(sandbox);
      const script = new vm.Script(code, {
        filename: `sandbox-${executionId}.js`,
      });
      
      const result = script.runInContext(vmContext, { 
        timeout,
        displayErrors: true,
      });
      
      const executionTime = Date.now() - startTime;
      
      logger.debug('Code execution completed', { 
        executionId, 
        executionTime,
        logCount: logs.length,
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executionId,
            success: true,
            result: formatResult(result),
            logs,
            executionTime: `${executionTime}ms`,
          }, null, 2),
        }],
        metadata: {
          executionId,
          executionTime,
          logCount: logs.length,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const isTimeout = error.message?.includes('Script execution timed out');
      
      logger.warn('Code execution failed', { 
        executionId, 
        error: error.message,
        isTimeout,
        executionTime,
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executionId,
            success: false,
            error: isTimeout ? `Execution timed out after ${timeout}ms` : error.message,
            logs,
            executionTime: `${executionTime}ms`,
          }, null, 2),
        }],
        isError: true,
        metadata: {
          executionId,
          executionTime,
          isTimeout,
        },
      };
    }
  },
});

module.exports = {
  createSandbox,
  DEFAULT_TIMEOUT,
  MAX_TIMEOUT,
};
