const { pgTable, text, serial, integer, boolean, timestamp, jsonb } = require("drizzle-orm/pg-core");
const { relations } = require("drizzle-orm");

const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  scopes: jsonb("scopes").$type().notNull().default([]),
  rateLimit: integer("rate_limit").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

const providerSettings = pgTable("provider_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  apiKey: text("api_key"),
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

const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [activityLogs.apiKeyId],
    references: [apiKeys.id],
  }),
}));

module.exports = {
  apiKeys,
  providerSettings,
  serverSettings,
  activityLogs,
  chatHistory,
  activityLogsRelations,
};
