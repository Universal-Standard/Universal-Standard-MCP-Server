const { eq, desc, and } = require('drizzle-orm');
const { db } = require('./db');
const { apiKeys, providerSettings, serverSettings, activityLogs, chatHistory } = require('../shared/schema');
const crypto = require('crypto');

class DatabaseStorage {
  async getApiKeys() {
    const keys = await db.select().from(apiKeys).where(eq(apiKeys.isActive, true));
    return keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPreview: k.key ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : null,
      scopes: k.scopes,
      rateLimit: k.rateLimit,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));
  }

  async getApiKey(id) {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key;
  }

  async getApiKeyByKey(key) {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.key, key));
    return apiKey;
  }

  async createApiKey(data) {
    const key = `mcp_${crypto.randomBytes(24).toString('hex')}`;
    const [apiKey] = await db.insert(apiKeys).values({
      key,
      name: data.name,
      scopes: data.scopes || ['tools:read', 'tools:execute', 'prompts:read', 'resources:read', 'sampling'],
      rateLimit: data.rateLimit || 100,
    }).returning();
    return apiKey;
  }

  async updateApiKey(id, data) {
    const [apiKey] = await db.update(apiKeys)
      .set({ ...data })
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
    return await db.select().from(providerSettings);
  }

  async getProviderSetting(provider) {
    const [setting] = await db.select().from(providerSettings).where(eq(providerSettings.provider, provider));
    return setting;
  }

  async upsertProviderSetting(provider, data) {
    const existing = await this.getProviderSetting(provider);
    if (existing) {
      const [setting] = await db.update(providerSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(providerSettings.provider, provider))
        .returning();
      return setting;
    } else {
      const [setting] = await db.insert(providerSettings).values({
        provider,
        ...data,
      }).returning();
      return setting;
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
}

const storage = new DatabaseStorage();

module.exports = { storage, DatabaseStorage };
