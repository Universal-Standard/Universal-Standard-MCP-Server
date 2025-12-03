const logger = require('../../utils/logger');

const GITHUB_API_BASE = 'https://api.github.com';

class GitHubDiscovery {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
  }

  async search(toolName, options = {}) {
    const { maxResults = 5 } = options;
    const startTime = Date.now();
    
    logger.info('GitHub discovery started', { toolName });
    
    try {
      const searchQueries = [
        `${toolName} mcp server tool`,
        `${toolName} model context protocol`,
        `mcp-${toolName}`,
        `${toolName}-mcp-server`
      ];
      
      const results = [];
      
      for (const query of searchQueries) {
        const repos = await this.searchRepositories(query, Math.ceil(maxResults / searchQueries.length));
        results.push(...repos);
        
        if (results.length >= maxResults) break;
      }
      
      const uniqueResults = this.deduplicateResults(results).slice(0, maxResults);
      
      const enrichedResults = await Promise.all(
        uniqueResults.map(repo => this.enrichRepoData(repo, toolName))
      );
      
      const validResults = enrichedResults.filter(r => r.relevanceScore > 0.3);
      
      logger.info('GitHub discovery completed', { 
        toolName, 
        resultsFound: validResults.length,
        duration: Date.now() - startTime 
      });
      
      return {
        source: 'github',
        toolName,
        results: validResults.sort((a, b) => b.relevanceScore - a.relevanceScore),
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('GitHub discovery failed', { toolName, error: error.message });
      return {
        source: 'github',
        toolName,
        results: [],
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async searchRepositories(query, perPage = 5) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SPURS-MCP-Server'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const url = `${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`;
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 403) {
        logger.warn('GitHub rate limit hit');
        return [];
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.items || [];
  }

  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(repo => {
      if (seen.has(repo.full_name)) return false;
      seen.add(repo.full_name);
      return true;
    });
  }

  async enrichRepoData(repo, toolName) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SPURS-MCP-Server'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    let toolImplementation = null;
    let relevanceScore = this.calculateBaseRelevance(repo, toolName);
    
    try {
      const contents = await this.getRepoContents(repo.full_name, headers);
      const relevantFiles = this.findRelevantFiles(contents, toolName);
      
      if (relevantFiles.length > 0) {
        toolImplementation = await this.extractToolImplementation(repo.full_name, relevantFiles, headers);
        relevanceScore += 0.3;
      }
      
      const hasMcpKeywords = await this.checkForMcpKeywords(repo.full_name, headers);
      if (hasMcpKeywords) {
        relevanceScore += 0.2;
      }
    } catch (error) {
      logger.warn('Failed to enrich repo data', { repo: repo.full_name, error: error.message });
    }
    
    return {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      topics: repo.topics || [],
      updatedAt: repo.updated_at,
      relevanceScore: Math.min(relevanceScore, 1.0),
      toolImplementation
    };
  }

  calculateBaseRelevance(repo, toolName) {
    let score = 0;
    
    const nameLower = repo.name.toLowerCase();
    const toolLower = toolName.toLowerCase();
    
    if (nameLower.includes(toolLower)) score += 0.3;
    if (nameLower.includes('mcp')) score += 0.2;
    if (repo.description?.toLowerCase().includes(toolLower)) score += 0.1;
    if (repo.description?.toLowerCase().includes('mcp') || repo.description?.toLowerCase().includes('model context protocol')) score += 0.1;
    
    if (repo.stargazers_count > 100) score += 0.1;
    else if (repo.stargazers_count > 10) score += 0.05;
    
    const topics = repo.topics || [];
    if (topics.includes('mcp') || topics.includes('model-context-protocol')) score += 0.1;
    if (topics.includes(toolLower)) score += 0.1;
    
    return score;
  }

  async getRepoContents(fullName, headers, path = '') {
    const url = `${GITHUB_API_BASE}/repos/${fullName}/contents/${path}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) return [];
    
    return await response.json();
  }

  findRelevantFiles(contents, toolName) {
    if (!Array.isArray(contents)) return [];
    
    const relevantPatterns = [
      /tool.*\.js$/i,
      /tool.*\.ts$/i,
      /handler.*\.js$/i,
      /handler.*\.ts$/i,
      /index\.(js|ts)$/i,
      /server\.(js|ts)$/i,
      new RegExp(`${toolName}.*\\.(js|ts)$`, 'i')
    ];
    
    return contents
      .filter(item => item.type === 'file')
      .filter(item => relevantPatterns.some(pattern => pattern.test(item.name)))
      .map(item => item.path);
  }

  async extractToolImplementation(fullName, filePaths, headers) {
    for (const filePath of filePaths.slice(0, 3)) {
      try {
        const url = `${GITHUB_API_BASE}/repos/${fullName}/contents/${filePath}`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        if (data.encoding === 'base64') {
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          
          const toolMatch = this.extractToolDefinition(content);
          if (toolMatch) {
            return {
              filePath,
              content: content.slice(0, 10000),
              toolDefinition: toolMatch
            };
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  extractToolDefinition(content) {
    const patterns = [
      /(?:const|let|var)\s+(\w+)\s*=\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?(?:handler|execute|run):\s*(?:async\s*)?\([^)]*\)\s*=>/m,
      /\.register\s*\(\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?\}/m,
      /tools\.push\s*\(\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?\}/m,
      /export\s+(?:const|function)\s+(\w+)[\s\S]*?(?:handler|execute|run)/m
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return {
          pattern: pattern.toString(),
          match: match[0].slice(0, 500)
        };
      }
    }
    
    return null;
  }

  async checkForMcpKeywords(fullName, headers) {
    try {
      const readmeUrl = `${GITHUB_API_BASE}/repos/${fullName}/readme`;
      const response = await fetch(readmeUrl, { headers });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      if (data.encoding === 'base64') {
        const content = Buffer.from(data.content, 'base64').toString('utf8').toLowerCase();
        return content.includes('mcp') || 
               content.includes('model context protocol') || 
               content.includes('tool') ||
               content.includes('claude');
      }
    } catch {
      return false;
    }
    
    return false;
  }
}

module.exports = { GitHubDiscovery };
