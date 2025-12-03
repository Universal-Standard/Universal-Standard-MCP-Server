const logger = require('../../utils/logger');

const POSTMAN_API_BASE = 'https://api.getpostman.com';

class PostmanDiscovery {
  constructor() {
    this.apiKey = process.env.POSTMAN_API_KEY;
  }

  async search(toolName, options = {}) {
    const { maxResults = 5 } = options;
    const startTime = Date.now();
    
    logger.info('Postman discovery started', { toolName });
    
    if (!this.apiKey) {
      logger.info('Postman API key not configured, using public API search');
      return this.searchPublicApis(toolName, maxResults, startTime);
    }
    
    try {
      const collections = await this.searchCollections(toolName, maxResults);
      
      const enrichedResults = await Promise.all(
        collections.map(collection => this.enrichCollectionData(collection, toolName))
      );
      
      const validResults = enrichedResults.filter(r => r.relevanceScore > 0.3);
      
      logger.info('Postman discovery completed', { 
        toolName, 
        resultsFound: validResults.length,
        duration: Date.now() - startTime 
      });
      
      return {
        source: 'postman',
        toolName,
        results: validResults.sort((a, b) => b.relevanceScore - a.relevanceScore),
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Postman discovery failed', { toolName, error: error.message });
      return this.searchPublicApis(toolName, maxResults, startTime);
    }
  }

  async searchPublicApis(toolName, maxResults, startTime) {
    try {
      const publicApis = await this.searchPublicApiDirectory(toolName, maxResults);
      
      logger.info('Public API discovery completed', { 
        toolName, 
        resultsFound: publicApis.length,
        duration: Date.now() - startTime 
      });
      
      return {
        source: 'postman-public',
        toolName,
        results: publicApis,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Public API discovery failed', { toolName, error: error.message });
      return {
        source: 'postman-public',
        toolName,
        results: [],
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async searchCollections(query, limit = 5) {
    const headers = {
      'X-Api-Key': this.apiKey
    };
    
    try {
      const response = await fetch(`${POSTMAN_API_BASE}/collections`, { headers });
      
      if (!response.ok) {
        throw new Error(`Postman API error: ${response.status}`);
      }
      
      const data = await response.json();
      const collections = data.collections || [];
      
      const filtered = collections.filter(c => 
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(query.toLowerCase()))
      );
      
      return filtered.slice(0, limit);
    } catch (error) {
      logger.warn('Failed to search Postman collections', { error: error.message });
      return [];
    }
  }

  async searchPublicApiDirectory(query, limit = 5) {
    const searchTerms = [query, `${query} api`, `${query} rest`];
    const results = [];
    
    for (const term of searchTerms) {
      try {
        const url = `https://api.publicapis.org/entries?title=${encodeURIComponent(term)}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          if (data.entries) {
            results.push(...data.entries.map(entry => this.formatPublicApi(entry, query)));
          }
        }
      } catch (error) {
        continue;
      }
      
      if (results.length >= limit) break;
    }
    
    return this.deduplicateResults(results).slice(0, limit);
  }

  formatPublicApi(entry, query) {
    const relevanceScore = this.calculatePublicApiRelevance(entry, query);
    
    return {
      name: entry.API,
      description: entry.Description,
      category: entry.Category,
      url: entry.Link,
      auth: entry.Auth,
      https: entry.HTTPS,
      cors: entry.Cors,
      relevanceScore,
      apiSpec: {
        baseUrl: entry.Link,
        auth: entry.Auth,
        description: entry.Description
      }
    };
  }

  calculatePublicApiRelevance(entry, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    if (entry.API.toLowerCase().includes(queryLower)) score += 0.4;
    if (entry.Description?.toLowerCase().includes(queryLower)) score += 0.2;
    if (entry.Category?.toLowerCase().includes(queryLower)) score += 0.1;
    
    if (entry.HTTPS) score += 0.1;
    if (entry.Cors === 'yes') score += 0.1;
    if (!entry.Auth || entry.Auth === '') score += 0.1;
    
    return Math.min(score, 1.0);
  }

  async enrichCollectionData(collection, toolName) {
    let relevanceScore = 0.4;
    let endpoints = [];
    
    try {
      if (collection.uid) {
        const details = await this.getCollectionDetails(collection.uid);
        if (details && details.item) {
          endpoints = this.extractEndpoints(details.item);
          relevanceScore += 0.2;
          
          if (endpoints.length > 0) {
            relevanceScore += 0.2;
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to enrich collection data', { collection: collection.name, error: error.message });
    }
    
    return {
      id: collection.uid || collection.id,
      name: collection.name,
      description: collection.description,
      relevanceScore,
      endpoints,
      apiSpec: {
        collectionId: collection.uid || collection.id,
        endpoints: endpoints.slice(0, 10)
      }
    };
  }

  async getCollectionDetails(collectionId) {
    const headers = {
      'X-Api-Key': this.apiKey
    };
    
    const response = await fetch(`${POSTMAN_API_BASE}/collections/${collectionId}`, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to get collection: ${response.status}`);
    }
    
    const data = await response.json();
    return data.collection;
  }

  extractEndpoints(items, prefix = '') {
    const endpoints = [];
    
    for (const item of items) {
      if (item.request) {
        endpoints.push({
          name: item.name,
          method: item.request.method,
          path: prefix + (typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw || ''),
          description: item.request.description,
          headers: item.request.header,
          body: item.request.body
        });
      }
      
      if (item.item) {
        endpoints.push(...this.extractEndpoints(item.item, `${prefix}${item.name}/`));
      }
    }
    
    return endpoints;
  }

  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(r => {
      const key = r.name?.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = { PostmanDiscovery };
