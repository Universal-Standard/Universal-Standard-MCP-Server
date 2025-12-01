const { registry } = require('../mcp/toolRegistry');
const { v4: uuidv4 } = require('uuid');

registry.register({
  name: 'generate_uuid',
  description: 'Generate a new UUID',
  category: 'utility',
  inputSchema: {
    type: 'object',
    properties: {
      count: {
        type: 'integer',
        description: 'Number of UUIDs to generate',
        default: 1,
      },
    },
  },
  handler: async (args) => {
    const count = Math.min(args.count || 1, 100);
    const uuids = Array.from({ length: count }, () => uuidv4());
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ uuids }, null, 2),
      }],
    };
  },
});

registry.register({
  name: 'timestamp',
  description: 'Get current timestamp in various formats',
  category: 'utility',
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['iso', 'unix', 'unix_ms', 'date', 'time', 'all'],
        description: 'Output format',
        default: 'all',
      },
      timezone: {
        type: 'string',
        description: 'Timezone (e.g., America/New_York)',
      },
    },
  },
  handler: async (args) => {
    const now = new Date();
    const { format = 'all' } = args;
    
    const formats = {
      iso: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      unix_ms: now.getTime(),
      date: now.toDateString(),
      time: now.toTimeString(),
    };
    
    const result = format === 'all' ? formats : { [format]: formats[format] };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },
});

registry.register({
  name: 'json_format',
  description: 'Format and validate JSON',
  category: 'utility',
  inputSchema: {
    type: 'object',
    properties: {
      json: {
        type: 'string',
        description: 'JSON string to format',
      },
      indent: {
        type: 'integer',
        description: 'Indentation spaces',
        default: 2,
      },
    },
    required: ['json'],
  },
  handler: async (args) => {
    try {
      const parsed = JSON.parse(args.json);
      const formatted = JSON.stringify(parsed, null, args.indent || 2);
      
      return {
        content: [{
          type: 'text',
          text: formatted,
        }],
        metadata: { valid: true },
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Invalid JSON: ${error.message}`,
        }],
        isError: true,
        metadata: { valid: false },
      };
    }
  },
});

registry.register({
  name: 'base64',
  description: 'Encode or decode base64 strings',
  category: 'utility',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input string',
      },
      operation: {
        type: 'string',
        enum: ['encode', 'decode'],
        description: 'Operation to perform',
        default: 'encode',
      },
    },
    required: ['input'],
  },
  handler: async (args) => {
    const { input, operation = 'encode' } = args;
    
    try {
      const result = operation === 'encode'
        ? Buffer.from(input).toString('base64')
        : Buffer.from(input, 'base64').toString('utf-8');
      
      return {
        content: [{
          type: 'text',
          text: result,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  },
});

module.exports = {};
