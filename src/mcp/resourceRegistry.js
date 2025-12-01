const logger = require('../utils/logger');

class ResourceRegistry {
  constructor() {
    this.resources = new Map();
  }

  register(resource) {
    if (!resource.uri) {
      throw new Error('Resource must have a URI');
    }

    const resourceDef = {
      uri: resource.uri,
      name: resource.name || resource.uri,
      description: resource.description || '',
      mimeType: resource.mimeType || 'text/plain',
      handler: resource.handler,
    };

    this.resources.set(resource.uri, resourceDef);
    logger.info(`Resource registered: ${resource.uri}`);
    return this;
  }

  get(uri) {
    return this.resources.get(uri);
  }

  list() {
    return Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  async read(uri, context = {}) {
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    if (resource.handler) {
      return await resource.handler(context);
    }

    return { uri, contents: [] };
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
        name: 'US-SPURS Advanced MCP Server',
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
