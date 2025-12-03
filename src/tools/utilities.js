/**
 * Utility Tools
 * Common utility functions for data manipulation
 */
const { registry } = require('../mcp/toolRegistry');
const { v4: uuidv4 } = require('uuid');

const MAX_UUID_COUNT = 100;
const MAX_INDENT = 8;
const MAX_INPUT_LENGTH = 1000000;

/**
 * Create standardized MCP response
 * @param {*} data - Response data
 * @param {boolean} isError - Whether this is an error response
 * @param {Object} metadata - Additional metadata
 * @returns {Object} MCP response format
 */
function createResponse(data, isError = false, metadata = {}) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
    ...(isError && { isError: true }),
    ...(Object.keys(metadata).length > 0 && { metadata }),
  };
}

registry.register({
  name: 'generate_uuid',
  description: 'Generate one or more UUIDs (v4)',
  category: 'utility',
  inputSchema: {
    type: 'object',
    properties: {
      count: {
        type: 'integer',
        description: `Number of UUIDs to generate (1-${MAX_UUID_COUNT})`,
        default: 1,
        minimum: 1,
        maximum: MAX_UUID_COUNT,
      },
    },
  },
  handler: async (args) => {
    const count = Math.max(1, Math.min(parseInt(args.count) || 1, MAX_UUID_COUNT));
    const uuids = Array.from({ length: count }, () => uuidv4());
    
    return createResponse({ 
      uuids,
      count: uuids.length,
    });
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
        description: 'Output format (default: all)',
        default: 'all',
      },
      timezone: {
        type: 'string',
        description: 'IANA timezone (e.g., America/New_York, Europe/London)',
      },
    },
  },
  handler: async (args) => {
    const now = new Date();
    const { format = 'all', timezone } = args;
    
    const formats = {
      iso: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      unix_ms: now.getTime(),
      date: now.toDateString(),
      time: now.toTimeString(),
    };
    
    if (timezone) {
      try {
        formats.local = now.toLocaleString('en-US', { timeZone: timezone });
        formats.timezone = timezone;
      } catch {
        formats.timezoneError = `Invalid timezone: ${timezone}`;
      }
    }
    
    const result = format === 'all' ? formats : { [format]: formats[format] };
    
    return createResponse(result);
  },
});

registry.register({
  name: 'json_format',
  description: 'Format, validate, and prettify JSON strings',
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
        description: `Indentation spaces (0-${MAX_INDENT})`,
        default: 2,
        minimum: 0,
        maximum: MAX_INDENT,
      },
      sortKeys: {
        type: 'boolean',
        description: 'Sort object keys alphabetically',
        default: false,
      },
    },
    required: ['json'],
  },
  handler: async (args) => {
    const { json, indent = 2, sortKeys = false } = args;
    
    if (!json || typeof json !== 'string') {
      return createResponse('Error: JSON input is required', true, { valid: false });
    }
    
    if (json.length > MAX_INPUT_LENGTH) {
      return createResponse(`Error: Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`, true, { valid: false });
    }
    
    try {
      let parsed = JSON.parse(json);
      
      if (sortKeys && typeof parsed === 'object' && parsed !== null) {
        parsed = sortObjectKeys(parsed);
      }
      
      const safeIndent = Math.max(0, Math.min(parseInt(indent) || 2, MAX_INDENT));
      const formatted = JSON.stringify(parsed, null, safeIndent);
      
      return createResponse(formatted, false, { 
        valid: true,
        type: Array.isArray(parsed) ? 'array' : typeof parsed,
        length: formatted.length,
      });
    } catch (error) {
      return createResponse(`Invalid JSON: ${error.message}`, true, { valid: false });
    }
  },
});

/**
 * Recursively sort object keys
 * @param {*} obj - Object to sort
 * @returns {*} Sorted object
 */
function sortObjectKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortObjectKeys(obj[key]);
        return sorted;
      }, {});
  }
  return obj;
}

registry.register({
  name: 'base64',
  description: 'Encode or decode base64 strings',
  category: 'utility',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input string to encode/decode',
      },
      operation: {
        type: 'string',
        enum: ['encode', 'decode'],
        description: 'Operation to perform',
        default: 'encode',
      },
      urlSafe: {
        type: 'boolean',
        description: 'Use URL-safe base64 encoding',
        default: false,
      },
    },
    required: ['input'],
  },
  handler: async (args) => {
    const { input, operation = 'encode', urlSafe = false } = args;
    
    if (!input || typeof input !== 'string') {
      return createResponse('Error: Input string is required', true);
    }
    
    if (input.length > MAX_INPUT_LENGTH) {
      return createResponse(`Error: Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`, true);
    }
    
    try {
      let result;
      
      if (operation === 'encode') {
        result = Buffer.from(input, 'utf-8').toString('base64');
        if (urlSafe) {
          result = result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
      } else {
        let base64Input = input;
        if (urlSafe) {
          base64Input = input.replace(/-/g, '+').replace(/_/g, '/');
          const padding = (4 - (base64Input.length % 4)) % 4;
          base64Input += '='.repeat(padding);
        }
        result = Buffer.from(base64Input, 'base64').toString('utf-8');
      }
      
      return createResponse(result, false, {
        operation,
        inputLength: input.length,
        outputLength: result.length,
      });
    } catch (error) {
      return createResponse(`Error: ${error.message}`, true);
    }
  },
});

module.exports = { createResponse };
