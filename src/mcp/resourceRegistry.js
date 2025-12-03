/**
 * Resource Registry
 * Manages MCP resources and their handlers
 */
const logger = require('../utils/logger');

const VALID_MIME_TYPES = [
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'application/octet-stream',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
];

/**
 * Validate URI format
 * @param {string} uri - URI to validate
 * @returns {boolean}
 */
function isValidUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  return uri.startsWith('mcp://') || uri.startsWith('file://') || uri.startsWith('http://') || uri.startsWith('https://');
}

/**
 * @class ResourceRegistry
 * Manages registration and reading of MCP resources
 */
class ResourceRegistry {
  constructor() {
    this.resources = new Map();
  }

  /**
   * Register a new resource
   * @param {Object} resource - Resource definition
   * @param {string} resource.uri - Unique resource URI
   * @param {string} resource.name - Human-readable name
   * @param {string} resource.description - Resource description
   * @param {string} resource.mimeType - Content MIME type
   * @param {Function} resource.handler - Async handler function
   * @returns {ResourceRegistry} this for chaining
   */
  register(resource) {
    if (!resource.uri) {
      throw new Error('Resource must have a URI');
    }
    
    if (!isValidUri(resource.uri)) {
      throw new Error(`Invalid resource URI format: ${resource.uri}. Must start with mcp://, file://, http://, or https://`);
    }

    const mimeType = resource.mimeType || 'text/plain';
    if (!VALID_MIME_TYPES.includes(mimeType) && !mimeType.includes('/')) {
      logger.warn(`Non-standard MIME type: ${mimeType}`);
    }

    const resourceDef = {
      uri: resource.uri,
      name: resource.name || resource.uri,
      description: resource.description || '',
      mimeType,
      handler: resource.handler,
    };

    this.resources.set(resource.uri, resourceDef);
    logger.info(`Resource registered: ${resource.uri}`);
    return this;
  }

  /**
   * Get resource by URI
   * @param {string} uri - Resource URI
   * @returns {Object|undefined}
   */
  get(uri) {
    return this.resources.get(uri);
  }

  /**
   * Check if resource exists
   * @param {string} uri - Resource URI
   * @returns {boolean}
   */
  has(uri) {
    return this.resources.has(uri);
  }

  /**
   * List all registered resources
   * @returns {Array} List of resource definitions
   */
  list() {
    return Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  /**
   * Read resource content
   * @param {string} uri - Resource URI
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Resource content
   * @throws {Error} If resource not found
   */
  async read(uri, context = {}) {
    const resource = this.resources.get(uri);
    if (!resource) {
      const error = new Error(`Resource not found: ${uri}`);
      error.statusCode = 404;
      throw error;
    }

    const startTime = Date.now();
    
    try {
      if (resource.handler) {
        const result = await resource.handler(context);
        const duration = Date.now() - startTime;
        logger.debug(`Resource read: ${uri}`, { duration: `${duration}ms` });
        return result;
      }

      return { uri, contents: [] };
    } catch (error) {
      logger.error(`Error reading resource: ${uri}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Unregister a resource
   * @param {string} uri - Resource URI
   * @returns {boolean} True if resource was removed
   */
  unregister(uri) {
    const existed = this.resources.delete(uri);
    if (existed) {
      logger.info(`Resource unregistered: ${uri}`);
    }
    return existed;
  }

  /**
   * Get count of registered resources
   * @returns {number}
   */
  get count() {
    return this.resources.size;
  }
}

const resourceRegistry = new ResourceRegistry();

resourceRegistry.register({
  uri: 'mcp://server/info',
  name: 'Server Information',
  description: 'Information about the MCP server',
  mimeType: 'application/json',
  handler: async () => ({
    uri: 'mcp://server/info',
    contents: [{
      uri: 'mcp://server/info',
      mimeType: 'application/json',
      text: JSON.stringify({
        name: 'SPURS MCP Server',
        version: '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
      }),
    }],
  }),
});

resourceRegistry.register({
  uri: 'mcp://server/capabilities',
  name: 'Server Capabilities',
  description: 'List of server capabilities',
  mimeType: 'application/json',
  handler: async () => ({
    uri: 'mcp://server/capabilities',
    contents: [{
      uri: 'mcp://server/capabilities',
      mimeType: 'application/json',
      text: JSON.stringify({
        tools: true,
        prompts: true,
        resources: true,
        sampling: true,
        streaming: true,
      }),
    }],
  }),
});

module.exports = { ResourceRegistry, resourceRegistry };
