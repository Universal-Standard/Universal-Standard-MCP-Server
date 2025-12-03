const { eq, desc, and, sql } = require('drizzle-orm');
const { db } = require('./db');
const { apiKeys, providerSettings, serverSettings, activityLogs, chatHistory, generatedTools, toolCreationLogs } = require('../shared/schema');
const { encrypt, decrypt, hashApiKey, generateApiKey, getKeyPrefix } = require('../src/utils/encryption');

class DatabaseStorage {
  async getApiKeys() {
    const keys = await db.select().from(apiKeys).where(eq(apiKeys.isActive, true));
    return keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      rateLimit: k.rateLimit,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt
    }));
  }

  async getApiKey(id) {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key;
  }

  async getApiKeyByKey(rawKey) {
    const keyHash = hashApiKey(rawKey);
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return apiKey;
  }

  async createApiKey(data) {
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);
    
    const [apiKey] = await db.insert(apiKeys).values({
      keyHash,
      keyPrefix,
      name: data.name,
      scopes: data.scopes || ['tools:read', 'tools:execute', 'prompts:read', 'resources:read', 'sampling'],
      rateLimit: data.rateLimit || 100,
      expiresAt: data.expiresAt || null,
    }).returning();
    
    return { ...apiKey, key: rawKey };
  }

  async updateApiKey(id, data) {
    const updateData = { ...data };
    delete updateData.key;
    delete updateData.keyHash;
    
    const [apiKey] = await db.update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id))
      .returning();
    return apiKey;
  }

  async deleteApiKey(id) {
    const [apiKey] = await db.update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, id))
      .returning();
    return apiKey;
  }

  async updateApiKeyLastUsed(id) {
    await db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async getProviderSettings() {
    const settings = await db.select().from(providerSettings);
    return settings.map(s => ({
      ...s,
      apiKey: s.encryptedApiKey ? decrypt(s.encryptedApiKey) : null
    }));
  }

  async getProviderSetting(provider) {
    const [setting] = await db.select().from(providerSettings).where(eq(providerSettings.provider, provider));
    if (setting) {
      return {
        ...setting,
        apiKey: setting.encryptedApiKey ? decrypt(setting.encryptedApiKey) : null
      };
    }
    return setting;
  }

  async upsertProviderSetting(provider, data) {
    const updateData = { ...data };
    if (data.apiKey) {
      updateData.encryptedApiKey = encrypt(data.apiKey);
      delete updateData.apiKey;
    }
    
    const existing = await this.getProviderSetting(provider);
    if (existing) {
      const [setting] = await db.update(providerSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(providerSettings.provider, provider))
        .returning();
      return {
        ...setting,
        apiKey: setting.encryptedApiKey ? decrypt(setting.encryptedApiKey) : null
      };
    } else {
      const [setting] = await db.insert(providerSettings).values({
        provider,
        ...updateData,
      }).returning();
      return {
        ...setting,
        apiKey: setting.encryptedApiKey ? decrypt(setting.encryptedApiKey) : null
      };
    }
  }

  async getServerSettings() {
    const settings = await db.select().from(serverSettings);
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});
  }

  async getServerSetting(key) {
    const [setting] = await db.select().from(serverSettings).where(eq(serverSettings.key, key));
    return setting?.value;
  }

  async setServerSetting(key, value) {
    const existing = await this.getServerSetting(key);
    if (existing !== undefined) {
      const [setting] = await db.update(serverSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(serverSettings.key, key))
        .returning();
      return setting;
    } else {
      const [setting] = await db.insert(serverSettings).values({
        key,
        value,
      }).returning();
      return setting;
    }
  }

  async logActivity(type, action, details = {}, apiKeyId = null, ipAddress = null, userAgent = null) {
    const [log] = await db.insert(activityLogs).values({
      type,
      action,
      details,
      apiKeyId,
      ipAddress,
      userAgent,
    }).returning();
    return log;
  }

  async getActivityLogs(limit = 100, offset = 0, type = null) {
    let query = db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(limit).offset(offset);
    if (type) {
      query = db.select().from(activityLogs).where(eq(activityLogs.type, type)).orderBy(desc(activityLogs.timestamp)).limit(limit).offset(offset);
    }
    return await query;
  }

  async saveChatMessage(sessionId, provider, model, role, content, metadata = {}) {
    const [message] = await db.insert(chatHistory).values({
      sessionId,
      provider,
      model,
      role,
      content,
      metadata,
    }).returning();
    return message;
  }

  async getChatHistory(sessionId, limit = 50) {
    return await db.select()
      .from(chatHistory)
      .where(eq(chatHistory.sessionId, sessionId))
      .orderBy(chatHistory.createdAt)
      .limit(limit);
  }

  async getChatSessions(limit = 20) {
    const sessions = await db.selectDistinct({ sessionId: chatHistory.sessionId })
      .from(chatHistory)
      .orderBy(desc(chatHistory.createdAt))
      .limit(limit);
    return sessions.map(s => s.sessionId);
  }

  async getGeneratedTools(status = 'active') {
    if (status) {
      return await db.select().from(generatedTools).where(eq(generatedTools.status, status)).orderBy(desc(generatedTools.createdAt));
    }
    return await db.select().from(generatedTools).orderBy(desc(generatedTools.createdAt));
  }

  async getGeneratedTool(name) {
    const [tool] = await db.select().from(generatedTools).where(eq(generatedTools.name, name));
    return tool;
  }

  async getGeneratedToolById(id) {
    const [tool] = await db.select().from(generatedTools).where(eq(generatedTools.id, id));
    return tool;
  }

  async createGeneratedTool(data) {
    const [tool] = await db.insert(generatedTools).values({
      name: data.name,
      description: data.description,
      category: data.category || 'generated',
      inputSchema: data.inputSchema,
      handlerCode: data.handlerCode,
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl || null,
      sourceData: data.sourceData || {},
      version: 1,
      status: data.status || 'active',
      testResults: data.testResults || {},
      securityScan: data.securityScan || {},
    }).returning();
    return tool;
  }

  async updateGeneratedTool(id, data) {
    const updateData = { ...data, updatedAt: new Date() };
    const [tool] = await db.update(generatedTools)
      .set(updateData)
      .where(eq(generatedTools.id, id))
      .returning();
    return tool;
  }

  async incrementToolUsage(id) {
    await db.update(generatedTools)
      .set({ 
        usageCount: sql`${generatedTools.usageCount} + 1`,
        lastUsedAt: new Date() 
      })
      .where(eq(generatedTools.id, id));
  }

  async deleteGeneratedTool(id) {
    const [tool] = await db.update(generatedTools)
      .set({ status: 'disabled' })
      .where(eq(generatedTools.id, id))
      .returning();
    return tool;
  }

  async logToolCreation(toolName, stage, status, details = {}, aiPromptUsed = null, aiResponse = null, duration = null, toolId = null) {
    const [log] = await db.insert(toolCreationLogs).values({
      toolId,
      toolName,
      stage,
      status,
      details,
      aiPromptUsed,
      aiResponse,
      duration,
    }).returning();
    return log;
  }

  async getToolCreationLogs(toolName = null, limit = 100) {
    if (toolName) {
      return await db.select()
        .from(toolCreationLogs)
        .where(eq(toolCreationLogs.toolName, toolName))
        .orderBy(desc(toolCreationLogs.createdAt))
        .limit(limit);
    }
    return await db.select()
      .from(toolCreationLogs)
      .orderBy(desc(toolCreationLogs.createdAt))
      .limit(limit);
  }
}

const storage = new DatabaseStorage();

module.exports = { storage, DatabaseStorage };
