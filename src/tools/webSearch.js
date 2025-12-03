/**
 * Web Search Tool
 * Provides web search functionality
 * Note: Currently returns placeholder results. Integrate with a real search API for production.
 */
const { registry } = require('../mcp/toolRegistry');
const logger = require('../utils/logger');

const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 50;
const DEFAULT_MAX_RESULTS = 10;

/**
 * Sanitize search query
 * @param {string} query - Raw query string
 * @returns {string} Sanitized query
 */
function sanitizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  return query.trim().slice(0, MAX_QUERY_LENGTH);
}

registry.register({
  name: 'web_search',
  description: 'Search the web for information on a topic. Returns structured search results.',
  category: 'search',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
        minLength: 1,
        maxLength: MAX_QUERY_LENGTH,
      },
      max_results: {
        type: 'integer',
        description: `Maximum number of results to return (1-${MAX_RESULTS})`,
        default: DEFAULT_MAX_RESULTS,
        minimum: 1,
        maximum: MAX_RESULTS,
      },
    },
    required: ['query'],
  },
  handler: async (args, context) => {
    const query = sanitizeQuery(args.query);
    const maxResults = Math.max(1, Math.min(parseInt(args.max_results) || DEFAULT_MAX_RESULTS, MAX_RESULTS));
    
    if (!query) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Search query is required' }, null, 2),
        }],
        isError: true,
      };
    }
    
    logger.info('Web search executed', { 
      query, 
      maxResults,
      userId: context?.user?.id,
    });
    
    const response = {
      query,
      maxResults,
      results: [
        {
          title: `Search results for: ${query}`,
          snippet: 'This is a placeholder for web search results. In production, integrate with a real search API like Google Custom Search, Bing, or SerpAPI.',
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          position: 1,
        }
      ],
      totalResults: 1,
      searchTime: 0,
      status: 'placeholder',
      note: 'To enable real search, configure a search API provider (SEARCH_API_KEY)',
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
      metadata: {
        resultCount: response.results.length,
        isPlaceholder: true,
      },
    };
  },
});

module.exports = {
  MAX_QUERY_LENGTH,
  MAX_RESULTS,
};
