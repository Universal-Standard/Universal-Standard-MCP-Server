const { registry } = require('../mcp/toolRegistry');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

registry.register({
  name: 'code_sandbox',
  description: 'Execute code in a sandboxed environment (JavaScript only for security)',
  category: 'code',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code to execute',
      },
      timeout: {
        type: 'integer',
        description: 'Execution timeout in milliseconds',
        default: 5000,
      },
    },
    required: ['code'],
  },
  handler: async (args, context) => {
    const { code, timeout = 5000 } = args;
    const executionId = uuidv4();
    
    logger.info('Code execution requested', { executionId });
    
    try {
      const vm = require('vm');
      const sandbox = {
        console: {
          log: (...args) => logs.push({ type: 'log', args }),
          error: (...args) => logs.push({ type: 'error', args }),
          warn: (...args) => logs.push({ type: 'warn', args }),
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
        Map,
        Set,
        Promise,
      };
      
      const logs = [];
      const script = new vm.Script(code);
      const context = vm.createContext(sandbox);
      
      const result = script.runInContext(context, { timeout });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executionId,
            success: true,
            result: result !== undefined ? String(result) : undefined,
            logs,
          }, null, 2),
        }],
      };
    } catch (error) {
      logger.error('Code execution failed', { executionId, error: error.message });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executionId,
            success: false,
            error: error.message,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
});

module.exports = {};
