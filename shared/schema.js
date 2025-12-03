const { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid } = require("drizzle-orm/pg-core");
const { relations, sql } = require("drizzle-orm");

const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  name: text("name").notNull(),
  scopes: jsonb("scopes").$type().notNull().default([]),
  rateLimit: integer("rate_limit").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
});

const providerSettings = pgTable("provider_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  encryptedApiKey: text("encrypted_api_key"),
  defaultModel: text("default_model"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  settings: jsonb("settings").default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const serverSettings = pgTable("server_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  action: text("action").notNull(),
  details: jsonb("details").default({}),
  apiKeyId: integer("api_key_id").references(() => apiKeys.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

const chatHistory = pgTable("chat_history", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const generatedTools = pgTable("generated_tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull().default('generated'),
  inputSchema: jsonb("input_schema").notNull(),
  handlerCode: text("handler_code").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  sourceData: jsonb("source_data").default({}),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default('active'),
  testResults: jsonb("test_results").default({}),
  securityScan: jsonb("security_scan").default({}),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const toolCreationLogs = pgTable("tool_creation_logs", {
  id: serial("id").primaryKey(),
  toolId: integer("tool_id").references(() => generatedTools.id),
  toolName: text("tool_name").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
  details: jsonb("details").default({}),
  aiPromptUsed: text("ai_prompt_used"),
  aiResponse: text("ai_response"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [activityLogs.apiKeyId],
    references: [apiKeys.id],
  }),
}));

const generatedToolsRelations = relations(generatedTools, ({ many }) => ({
  creationLogs: many(toolCreationLogs),
}));

const toolCreationLogsRelations = relations(toolCreationLogs, ({ one }) => ({
  tool: one(generatedTools, {
    fields: [toolCreationLogs.toolId],
    references: [generatedTools.id],
  }),
}));

module.exports = {
  apiKeys,
  providerSettings,
  serverSettings,
  activityLogs,
  chatHistory,
  generatedTools,
  toolCreationLogs,
  activityLogsRelations,
  generatedToolsRelations,
  toolCreationLogsRelations,
};
