import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";
import type {
  Company,
  Agent,
  Conversation,
  Message,
  MemoryEntry,
} from "./types";

import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const DB_PATH = path.join(dataDir, "autonomous.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT,
      role_title TEXT,
      company_name TEXT,
      company_website TEXT,
      company_size TEXT,
      industry TEXT,
      current_tools TEXT,
      biggest_challenges TEXT,
      automation_goals TEXT,
      timezone TEXT DEFAULT 'UTC',
      debrief_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      industry TEXT,
      description TEXT,
      stage TEXT,
      analysis_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      role TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      company_context TEXT,
      skills_json TEXT,
      connectors_json TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 1000,
      total_earned INTEGER NOT NULL DEFAULT 1000,
      total_spent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      balance_after INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_custom_skills (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      skill TEXT NOT NULL,
      added_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(agent_id, skill)
    );

    CREATE TABLE IF NOT EXISTS agent_actions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      source TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(agent_id, key)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      input_json TEXT,
      result_json TEXT,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      scheduled_at TEXT,
      cron_expression TEXT,
      is_recurring INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      user_id TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      invite_status TEXT DEFAULT 'pending',
      invite_token TEXT UNIQUE,
      invited_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_assignments (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      user_id TEXT NOT NULL,
      assigned_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(agent_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS debriefs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      delivered_via TEXT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id)
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      month TEXT NOT NULL,
      task_count INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      UNIQUE(company_id, month)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inter_agent_messages (
      id TEXT PRIMARY KEY,
      source_agent_id TEXT NOT NULL REFERENCES agents(id),
      target_agent_id TEXT NOT NULL REFERENCES agents(id),
      request TEXT NOT NULL,
      response TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      conversation_id TEXT REFERENCES conversations(id),
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messaging_users (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      platform TEXT NOT NULL,
      platform_user_id TEXT NOT NULL,
      display_name TEXT,
      default_agent_id TEXT REFERENCES agents(id),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(platform, platform_user_id)
    );

    CREATE TABLE IF NOT EXISTS file_uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      company_id TEXT,
      agent_id TEXT,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      service_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      config_json TEXT,
      is_active INTEGER DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id, service_name)
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      name TEXT NOT NULL,
      description TEXT,
      secret TEXT,
      task_type TEXT DEFAULT 'webhook',
      task_title_template TEXT DEFAULT 'Webhook: {name}',
      is_active INTEGER DEFAULT 1,
      last_triggered_at TEXT,
      trigger_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chai_time_sessions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      agent_summaries TEXT,
      cross_updates TEXT,
      status TEXT DEFAULT 'running'
    );

    CREATE TABLE IF NOT EXISTS chai_time_config (
      company_id TEXT PRIMARY KEY REFERENCES companies(id),
      enabled INTEGER DEFAULT 1,
      time_hour INTEGER DEFAULT 17,
      time_minute INTEGER DEFAULT 0,
      timezone TEXT DEFAULT 'UTC',
      last_run_at TEXT
    );
  `);
}

// ─── Chai Time ───────────────────────────────────────────
export interface ChaiTimeSession {
  id: string;
  company_id: string;
  started_at: string;
  completed_at: string | null;
  agent_summaries: string | null;
  cross_updates: string | null;
  status: string;
}

export interface ChaiTimeConfig {
  company_id: string;
  enabled: number;
  time_hour: number;
  time_minute: number;
  timezone: string;
  last_run_at: string | null;
}

export function getChaiTimeConfig(companyId: string): ChaiTimeConfig {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM chai_time_config WHERE company_id = ?")
    .get(companyId) as ChaiTimeConfig | undefined;
  if (existing) return existing;
  db.prepare(
    `INSERT INTO chai_time_config (company_id) VALUES (?)`
  ).run(companyId);
  return db
    .prepare("SELECT * FROM chai_time_config WHERE company_id = ?")
    .get(companyId) as ChaiTimeConfig;
}

export function updateChaiTimeConfig(
  companyId: string,
  config: { enabled?: number; time_hour?: number; time_minute?: number; timezone?: string; last_run_at?: string }
): void {
  const db = getDb();
  // Ensure row exists
  getChaiTimeConfig(companyId);
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (config.enabled !== undefined) { sets.push("enabled = ?"); values.push(config.enabled); }
  if (config.time_hour !== undefined) { sets.push("time_hour = ?"); values.push(config.time_hour); }
  if (config.time_minute !== undefined) { sets.push("time_minute = ?"); values.push(config.time_minute); }
  if (config.timezone !== undefined) { sets.push("timezone = ?"); values.push(config.timezone); }
  if (config.last_run_at !== undefined) { sets.push("last_run_at = ?"); values.push(config.last_run_at); }
  if (sets.length === 0) return;
  values.push(companyId);
  db.prepare(`UPDATE chai_time_config SET ${sets.join(", ")} WHERE company_id = ?`).run(...values);
}

export function createChaiTimeSession(companyId: string): ChaiTimeSession {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO chai_time_sessions (id, company_id) VALUES (?, ?)`
  ).run(id, companyId);
  return db.prepare("SELECT * FROM chai_time_sessions WHERE id = ?").get(id) as ChaiTimeSession;
}

export function updateChaiTimeSession(
  sessionId: string,
  data: { agent_summaries?: string; cross_updates?: string; status?: string; completed_at?: string }
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: (string)[] = [];
  if (data.agent_summaries !== undefined) { sets.push("agent_summaries = ?"); values.push(data.agent_summaries); }
  if (data.cross_updates !== undefined) { sets.push("cross_updates = ?"); values.push(data.cross_updates); }
  if (data.status !== undefined) { sets.push("status = ?"); values.push(data.status); }
  if (data.completed_at !== undefined) { sets.push("completed_at = ?"); values.push(data.completed_at); }
  if (sets.length === 0) return;
  values.push(sessionId);
  db.prepare(`UPDATE chai_time_sessions SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getLatestChaiTimeSession(companyId: string): ChaiTimeSession | undefined {
  return getDb()
    .prepare("SELECT * FROM chai_time_sessions WHERE company_id = ? ORDER BY started_at DESC LIMIT 1")
    .get(companyId) as ChaiTimeSession | undefined;
}

export function getChaiTimeSessions(companyId: string, limit = 7): ChaiTimeSession[] {
  return getDb()
    .prepare("SELECT * FROM chai_time_sessions WHERE company_id = ? ORDER BY started_at DESC LIMIT ?")
    .all(companyId, limit) as ChaiTimeSession[];
}

// ─── Companies ───────────────────────────────────────────
export function createCompany(data: {
  name: string;
  url: string;
  user_id?: string;
  industry?: string;
  description?: string;
  stage?: string;
  analysis_json?: string;
}): Company {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO companies (id, user_id, name, url, industry, description, stage, analysis_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.user_id ?? null,
    data.name,
    data.url,
    data.industry ?? null,
    data.description ?? null,
    data.stage ?? null,
    data.analysis_json ?? null
  );
  return db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Company;
}

export function getCompaniesByUser(userId: string): Company[] {
  return getDb()
    .prepare("SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Company[];
}

export function getCompany(id: string): Company | undefined {
  return getDb()
    .prepare("SELECT * FROM companies WHERE id = ?")
    .get(id) as Company | undefined;
}

export function claimCompanyForUser(companyId: string, userId: string): void {
  getDb()
    .prepare("UPDATE companies SET user_id = ? WHERE id = ? AND user_id IS NULL")
    .run(userId, companyId);
}

// ─── Agents ──────────────────────────────────────────────
export function createAgent(data: {
  company_id: string;
  role: string;
  system_prompt: string;
  company_context?: string;
  skills_json?: string;
  connectors_json?: string;
}): Agent {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO agents (id, company_id, role, system_prompt, company_context, skills_json, connectors_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.company_id,
    data.role,
    data.system_prompt,
    data.company_context ?? null,
    data.skills_json ?? null,
    data.connectors_json ?? null
  );
  return db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent;
}

export function getAgent(id: string): Agent | undefined {
  return getDb()
    .prepare("SELECT * FROM agents WHERE id = ?")
    .get(id) as Agent | undefined;
}

export function getAgentsByCompany(companyId: string): Agent[] {
  return getDb()
    .prepare("SELECT * FROM agents WHERE company_id = ? ORDER BY created_at")
    .all(companyId) as Agent[];
}

export function getAgentRoster(companyId: string): { role: string; id: string }[] {
  return getDb()
    .prepare("SELECT id, role FROM agents WHERE company_id = ? AND status = 'active'")
    .all(companyId) as { role: string; id: string }[];
}

// ─── Conversations ───────────────────────────────────────
export function createConversation(agentId: string, title?: string): Conversation {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO conversations (id, agent_id, title) VALUES (?, ?, ?)`
  ).run(id, agentId, title ?? null);
  return db
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as Conversation;
}

export function getConversation(id: string): Conversation | undefined {
  return getDb()
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as Conversation | undefined;
}

export function getConversationsByAgent(agentId: string): Conversation[] {
  return getDb()
    .prepare(
      "SELECT * FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC"
    )
    .all(agentId) as Conversation[];
}

// ─── Messages ────────────────────────────────────────────
export function addMessage(data: {
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
}): Message {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)`
  ).run(id, data.conversation_id, data.role, data.content);
  db.prepare(
    "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
  ).run(data.conversation_id);
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message;
}

export function getMessages(
  conversationId: string,
  limit = 50
): Message[] {
  return getDb()
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
    )
    .all(conversationId, limit) as Message[];
}

// ─── Memory ──────────────────────────────────────────────
export function getMemory(agentId: string): MemoryEntry[] {
  return getDb()
    .prepare(
      "SELECT * FROM memory WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 20"
    )
    .all(agentId) as MemoryEntry[];
}

export function setMemory(
  agentId: string,
  key: string,
  value: string
): void {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO memory (id, agent_id, key, value)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(agent_id, key)
     DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(id, agentId, key, value);
}

// ─── User Profiles ───────────────────────────────────────
export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  role_title: string | null;
  company_name: string | null;
  company_website: string | null;
  company_size: string | null;
  industry: string | null;
  current_tools: string | null;
  biggest_challenges: string | null;
  automation_goals: string | null;
  created_at: string;
  updated_at: string;
}

export function getUserProfile(userId: string): UserProfile | undefined {
  return getDb()
    .prepare("SELECT * FROM user_profiles WHERE user_id = ?")
    .get(userId) as UserProfile | undefined;
}

export function upsertUserProfile(
  userId: string,
  data: {
    full_name?: string;
    role_title?: string;
    company_name?: string;
    company_website?: string;
    company_size?: string;
    industry?: string;
    current_tools?: string;
    biggest_challenges?: string;
    automation_goals?: string;
  }
): UserProfile {
  const db = getDb();
  const existing = getUserProfile(userId);

  if (existing) {
    db.prepare(
      `UPDATE user_profiles SET
        full_name = ?, role_title = ?, company_name = ?, company_website = ?,
        company_size = ?, industry = ?, current_tools = ?,
        biggest_challenges = ?, automation_goals = ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(
      data.full_name ?? existing.full_name,
      data.role_title ?? existing.role_title,
      data.company_name ?? existing.company_name,
      data.company_website ?? existing.company_website,
      data.company_size ?? existing.company_size,
      data.industry ?? existing.industry,
      data.current_tools ?? existing.current_tools,
      data.biggest_challenges ?? existing.biggest_challenges,
      data.automation_goals ?? existing.automation_goals,
      userId
    );
  } else {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO user_profiles (id, user_id, full_name, role_title, company_name, company_website, company_size, industry, current_tools, biggest_challenges, automation_goals)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, userId,
      data.full_name ?? null, data.role_title ?? null,
      data.company_name ?? null, data.company_website ?? null,
      data.company_size ?? null, data.industry ?? null,
      data.current_tools ?? null, data.biggest_challenges ?? null,
      data.automation_goals ?? null
    );
  }

  return getUserProfile(userId)!;
}

// ─── Credits ─────────────────────────────────────────────
export const CREDITS_PER_PROMPT = 50; // ~20 prompts per 1000 credits
export const SIGNUP_CREDITS = 1000;

export interface CreditBalance {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "signup" | "topup" | "usage" | "refund";
  description: string | null;
  balance_after: number;
  created_at: string;
}

export function getCredits(userId: string): CreditBalance {
  const db = getDb();
  let row = db
    .prepare("SELECT * FROM credits WHERE user_id = ?")
    .get(userId) as CreditBalance | undefined;

  if (!row) {
    // Auto-create with signup bonus
    const id = randomUUID();
    db.prepare(
      `INSERT INTO credits (id, user_id, balance, total_earned, total_spent)
       VALUES (?, ?, ?, ?, 0)`
    ).run(id, userId, SIGNUP_CREDITS, SIGNUP_CREDITS);

    // Record the signup transaction
    const txId = randomUUID();
    db.prepare(
      `INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after)
       VALUES (?, ?, ?, 'signup', 'Welcome bonus — 1000 free credits', ?)`
    ).run(txId, userId, SIGNUP_CREDITS, SIGNUP_CREDITS);

    row = db
      .prepare("SELECT * FROM credits WHERE user_id = ?")
      .get(userId) as CreditBalance;
  }

  return row;
}

export function hasEnoughCredits(userId: string, cost: number = CREDITS_PER_PROMPT): boolean {
  const credits = getCredits(userId);
  return credits.balance >= cost;
}

export function deductCredits(
  userId: string,
  amount: number,
  description: string
): { success: boolean; balance: number } {
  const db = getDb();
  const credits = getCredits(userId);

  if (credits.balance < amount) {
    return { success: false, balance: credits.balance };
  }

  const newBalance = credits.balance - amount;
  db.prepare(
    `UPDATE credits SET balance = ?, total_spent = total_spent + ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(newBalance, amount, userId);

  const txId = randomUUID();
  db.prepare(
    `INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after)
     VALUES (?, ?, ?, 'usage', ?, ?)`
  ).run(txId, userId, -amount, description, newBalance);

  return { success: true, balance: newBalance };
}

export function addCredits(
  userId: string,
  amount: number,
  type: "topup" | "refund",
  description: string
): number {
  const db = getDb();
  const credits = getCredits(userId);
  const newBalance = credits.balance + amount;

  db.prepare(
    `UPDATE credits SET balance = ?, total_earned = total_earned + ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(newBalance, amount, userId);

  const txId = randomUUID();
  db.prepare(
    `INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(txId, userId, amount, type, description, newBalance);

  return newBalance;
}

export function getCreditTransactions(userId: string, limit = 20): CreditTransaction[] {
  return getDb()
    .prepare(
      "SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(userId, limit) as CreditTransaction[];
}

// ─── Agent Actions (Action Log) ──────────────────────────
export interface AgentAction {
  id: string;
  agent_id: string;
  action_type: string;
  title: string;
  detail: string | null;
  source: string;
  created_at: string;
}

export function logAgentAction(data: {
  agent_id: string;
  action_type: string;
  title: string;
  detail?: string;
  source?: string;
}): void {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO agent_actions (id, agent_id, action_type, title, detail, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.agent_id, data.action_type, data.title, data.detail ?? null, data.source ?? "system");
}

export function getAgentActions(agentId: string, limit = 20): AgentAction[] {
  return getDb()
    .prepare("SELECT * FROM agent_actions WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(agentId, limit) as AgentAction[];
}

export function getCompanyActions(companyId: string, limit = 50): AgentAction[] {
  return getDb()
    .prepare(
      `SELECT aa.* FROM agent_actions aa
       JOIN agents a ON aa.agent_id = a.id
       WHERE a.company_id = ?
       ORDER BY aa.created_at DESC LIMIT ?`
    )
    .all(companyId, limit) as AgentAction[];
}

// ─── Agent Custom Skills ─────────────────────────────────
export function getCustomSkills(agentId: string): string[] {
  const rows = getDb()
    .prepare("SELECT skill FROM agent_custom_skills WHERE agent_id = ? ORDER BY created_at")
    .all(agentId) as { skill: string }[];
  return rows.map((r) => r.skill);
}

export function addCustomSkill(agentId: string, skill: string, addedBy?: string): void {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT OR IGNORE INTO agent_custom_skills (id, agent_id, skill, added_by) VALUES (?, ?, ?, ?)`
  ).run(id, agentId, skill, addedBy ?? null);
}

export function removeCustomSkill(agentId: string, skill: string): void {
  getDb()
    .prepare("DELETE FROM agent_custom_skills WHERE agent_id = ? AND skill = ?")
    .run(agentId, skill);
}

// ─── API Keys ────────────────────────────────────────────
export interface ApiKey {
  id: string;
  company_id: string;
  key_hash: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

export function createApiKey(companyId: string, keyHash: string, name: string): ApiKey {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO api_keys (id, company_id, key_hash, name) VALUES (?, ?, ?, ?)"
  ).run(id, companyId, keyHash, name);
  return db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as ApiKey;
}

export function getApiKeyByHash(keyHash: string): ApiKey | undefined {
  const db = getDb();
  const key = db.prepare("SELECT * FROM api_keys WHERE key_hash = ?").get(keyHash) as ApiKey | undefined;
  if (key) {
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(key.id);
  }
  return key;
}

export function getApiKeysByCompany(companyId: string): ApiKey[] {
  return getDb()
    .prepare("SELECT * FROM api_keys WHERE company_id = ? ORDER BY created_at DESC")
    .all(companyId) as ApiKey[];
}

export function deleteApiKey(id: string): void {
  getDb().prepare("DELETE FROM api_keys WHERE id = ?").run(id);
}

// ─── Subscriptions & Billing ─────────────────────────────
export interface Subscription {
  id: string;
  company_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: "free" | "growth" | "enterprise";
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

const PLAN_LIMITS: Record<string, { agents: number; tasks: number }> = {
  free: { agents: 1, tasks: 100 },
  growth: { agents: 5, tasks: -1 },
  enterprise: { agents: -1, tasks: -1 },
};

export function getSubscription(companyId: string): Subscription | undefined {
  return getDb()
    .prepare("SELECT * FROM subscriptions WHERE company_id = ?")
    .get(companyId) as Subscription | undefined;
}

export function upsertSubscription(
  companyId: string,
  data: Partial<Omit<Subscription, "id" | "company_id" | "created_at" | "updated_at">>
): Subscription {
  const db = getDb();
  const existing = getSubscription(companyId);
  if (existing) {
    const fields: string[] = [];
    const values: (string | null)[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`);
        values.push(val as string | null);
      }
    }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(companyId);
      db.prepare(`UPDATE subscriptions SET ${fields.join(", ")} WHERE company_id = ?`).run(
        ...values
      );
    }
  } else {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO subscriptions (id, company_id, plan, status, stripe_customer_id, stripe_subscription_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      companyId,
      data.plan || "free",
      data.status || "active",
      data.stripe_customer_id ?? null,
      data.stripe_subscription_id ?? null
    );
  }
  return getSubscription(companyId)!;
}

export function getUsage(companyId: string): { task_count: number; message_count: number } {
  const month = new Date().toISOString().slice(0, 7);
  const row = getDb()
    .prepare("SELECT SUM(task_count) as task_count, SUM(message_count) as message_count FROM usage_records WHERE company_id = ? AND month = ?")
    .get(companyId, month) as { task_count: number | null; message_count: number | null } | undefined;
  return { task_count: row?.task_count || 0, message_count: row?.message_count || 0 };
}

export function incrementUsage(companyId: string, field: "task_count" | "message_count"): void {
  const db = getDb();
  const month = new Date().toISOString().slice(0, 7);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO usage_records (id, company_id, month, ${field})
     VALUES (?, ?, ?, 1)
     ON CONFLICT(company_id, month)
     DO UPDATE SET ${field} = ${field} + 1`
  ).run(id, companyId, month);
}

export function checkPlanLimits(companyId: string): {
  canProvision: boolean;
  canCreateTask: boolean;
  plan: string;
  agentCount: number;
  agentLimit: number;
  taskCount: number;
  taskLimit: number;
} {
  const sub = getSubscription(companyId);
  const plan = sub?.plan || "free";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const agents = getAgentsByCompany(companyId);
  const usage = getUsage(companyId);

  return {
    canProvision: limits.agents === -1 || agents.length < limits.agents,
    canCreateTask: limits.tasks === -1 || usage.task_count < limits.tasks,
    plan,
    agentCount: agents.length,
    agentLimit: limits.agents,
    taskCount: usage.task_count,
    taskLimit: limits.tasks,
  };
}

// ─── Tasks ───────────────────────────────────────────────
export interface Task {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  status: "queued" | "running" | "done" | "failed";
  input_json: string | null;
  result_json: string | null;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function createTask(data: {
  agent_id: string;
  type: string;
  title: string;
  input_json?: string;
}): Task {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, agent_id, type, title, input_json) VALUES (?, ?, ?, ?, ?)`
  ).run(id, data.agent_id, data.type, data.title, data.input_json ?? null);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;
}

export function getTasksByAgent(agentId: string): Task[] {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId) as Task[];
}

export function getTasksByCompany(companyId: string): Task[] {
  return getDb()
    .prepare(
      `SELECT t.* FROM tasks t
       JOIN agents a ON t.agent_id = a.id
       WHERE a.company_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(companyId) as Task[];
}

export function getNextQueuedTask(): Task | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM tasks WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
    )
    .get() as Task | undefined;
}

export function updateTaskStatus(
  id: string,
  status: "running" | "done" | "failed",
  result?: { result_json?: string; error_message?: string }
): void {
  const db = getDb();
  if (status === "done") {
    db.prepare(
      `UPDATE tasks SET status = 'done', result_json = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(result?.result_json ?? null, id);
  } else if (status === "failed") {
    db.prepare(
      `UPDATE tasks SET status = 'failed', error_message = ?, retry_count = retry_count + 1, completed_at = datetime('now') WHERE id = ?`
    ).run(result?.error_message ?? "Unknown error", id);
  } else {
    db.prepare("UPDATE tasks SET status = 'running' WHERE id = ?").run(id);
  }
}

export function requeueFailedTask(id: string): void {
  getDb()
    .prepare("UPDATE tasks SET status = 'queued', error_message = NULL WHERE id = ?")
    .run(id);
}

// ─── Inter-Agent Messages ────────────────────────────────
export interface InterAgentMessage {
  id: string;
  source_agent_id: string;
  target_agent_id: string;
  request: string;
  response: string | null;
  status: string;
  conversation_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export function createInterAgentMessage(data: {
  source_agent_id: string;
  target_agent_id: string;
  request: string;
  conversation_id?: string;
}): InterAgentMessage {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO inter_agent_messages (id, source_agent_id, target_agent_id, request, conversation_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, data.source_agent_id, data.target_agent_id, data.request, data.conversation_id ?? null);
  return db.prepare("SELECT * FROM inter_agent_messages WHERE id = ?").get(id) as InterAgentMessage;
}

export function completeInterAgentMessage(id: string, response: string): void {
  getDb()
    .prepare(
      `UPDATE inter_agent_messages SET response = ?, status = 'done', completed_at = datetime('now') WHERE id = ?`
    )
    .run(response, id);
}

// ─── Activity Feed ───────────────────────────────────────
export interface ActivityItem {
  type: "task" | "message" | "relay";
  agent_role: string;
  agent_id: string;
  title: string;
  detail: string | null;
  status: string;
  created_at: string;
}

export function getActivityFeed(companyId: string, limit = 20): ActivityItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM (
        SELECT 'task' as type, a.role as agent_role, a.id as agent_id,
                t.title as title, t.status as status,
                CASE WHEN t.result_json IS NOT NULL THEN substr(t.result_json, 1, 200) ELSE NULL END as detail,
                t.created_at as created_at
         FROM tasks t JOIN agents a ON t.agent_id = a.id
         WHERE a.company_id = ?
         UNION ALL
         SELECT 'relay' as type, sa.role as agent_role, sa.id as agent_id,
                'Asked @' || ta.role || ': ' || substr(iam.request, 1, 80) as title,
                iam.status as status,
                CASE WHEN iam.response IS NOT NULL THEN substr(iam.response, 1, 200) ELSE NULL END as detail,
                iam.created_at as created_at
         FROM inter_agent_messages iam
         JOIN agents sa ON iam.source_agent_id = sa.id
         JOIN agents ta ON iam.target_agent_id = ta.id
         WHERE sa.company_id = ?
       ) ORDER BY created_at DESC LIMIT ?`
    )
    .all(companyId, companyId, limit) as ActivityItem[];
}

// ─── Messaging Users ────────────────────────────────────
export interface MessagingUser {
  id: string;
  company_id: string;
  platform: string;
  platform_user_id: string;
  display_name: string | null;
  default_agent_id: string | null;
  created_at: string;
}

export function getMessagingUser(
  platform: string,
  platformUserId: string
): MessagingUser | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM messaging_users WHERE platform = ? AND platform_user_id = ?"
    )
    .get(platform, platformUserId) as MessagingUser | undefined;
}

export function createMessagingUser(data: {
  company_id: string;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  default_agent_id?: string;
}): MessagingUser {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO messaging_users (id, company_id, platform, platform_user_id, display_name, default_agent_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.company_id,
    data.platform,
    data.platform_user_id,
    data.display_name ?? null,
    data.default_agent_id ?? null
  );
  return db
    .prepare("SELECT * FROM messaging_users WHERE id = ?")
    .get(id) as MessagingUser;
}

export function updateDefaultAgent(id: string, agentId: string): void {
  getDb()
    .prepare("UPDATE messaging_users SET default_agent_id = ? WHERE id = ?")
    .run(agentId, id);
}

// ─── Scheduled Tasks ─────────────────────────────────────
export function createScheduledTask(data: {
  agent_id: string;
  type: string;
  title: string;
  input_json?: string;
  scheduled_at?: string;
  cron_expression?: string;
  is_recurring?: boolean;
}): Task {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, agent_id, type, title, input_json, scheduled_at, cron_expression, is_recurring, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`
  ).run(
    id, data.agent_id, data.type, data.title,
    data.input_json ?? null, data.scheduled_at ?? null,
    data.cron_expression ?? null, data.is_recurring ? 1 : 0
  );
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;
}

export function getScheduledDueTasks(): Task[] {
  return getDb()
    .prepare(
      `SELECT * FROM tasks WHERE is_recurring = 1 AND scheduled_at IS NOT NULL
       AND scheduled_at <= datetime('now') AND status = 'queued'
       ORDER BY scheduled_at ASC LIMIT 5`
    )
    .all() as Task[];
}

export function getScheduledTasksByCompany(companyId: string): Task[] {
  return getDb()
    .prepare(
      `SELECT t.* FROM tasks t JOIN agents a ON t.agent_id = a.id
       WHERE a.company_id = ? AND (t.is_recurring = 1 OR t.scheduled_at IS NOT NULL)
       ORDER BY t.created_at DESC`
    )
    .all(companyId) as Task[];
}

// ─── Team Members ────────────────────────────────────────
export interface TeamMember {
  id: string;
  company_id: string;
  user_id: string | null;
  email: string;
  phone: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  invite_status: string;
  invite_token: string | null;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

export function createTeamMember(data: {
  company_id: string;
  email: string;
  phone?: string;
  role?: string;
  user_id?: string;
  invited_by?: string;
}): TeamMember {
  const db = getDb();
  const id = randomUUID();
  const token = randomUUID();
  const status = data.user_id ? "accepted" : "pending";
  db.prepare(
    `INSERT INTO team_members (id, company_id, user_id, email, phone, role, invite_status, invite_token, invited_by${data.user_id ? ", accepted_at" : ""})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${data.user_id ? ", datetime('now')" : ""})`
  ).run(
    id, data.company_id, data.user_id ?? null, data.email,
    data.phone ?? null, data.role || "member", status, token,
    data.invited_by ?? null
  );
  return db.prepare("SELECT * FROM team_members WHERE id = ?").get(id) as TeamMember;
}

export function getTeamMembers(companyId: string): TeamMember[] {
  return getDb()
    .prepare("SELECT * FROM team_members WHERE company_id = ? ORDER BY created_at")
    .all(companyId) as TeamMember[];
}

export function getTeamMemberByUserId(companyId: string, userId: string): TeamMember | undefined {
  return getDb()
    .prepare("SELECT * FROM team_members WHERE company_id = ? AND user_id = ?")
    .get(companyId, userId) as TeamMember | undefined;
}

export function acceptInvite(token: string, userId: string): TeamMember | undefined {
  const db = getDb();
  db.prepare(
    "UPDATE team_members SET user_id = ?, invite_status = 'accepted', accepted_at = datetime('now') WHERE invite_token = ? AND invite_status = 'pending'"
  ).run(userId, token);
  return db.prepare("SELECT * FROM team_members WHERE invite_token = ?").get(token) as TeamMember | undefined;
}

export function updateTeamMemberRole(id: string, role: string): void {
  getDb().prepare("UPDATE team_members SET role = ? WHERE id = ?").run(role, id);
}

export function removeTeamMember(id: string): void {
  getDb().prepare("DELETE FROM team_members WHERE id = ?").run(id);
}

// ─── Agent Assignments ───────────────────────────────────
export function assignAgent(agentId: string, userId: string, assignedBy?: string): void {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT OR IGNORE INTO agent_assignments (id, agent_id, user_id, assigned_by) VALUES (?, ?, ?, ?)"
  ).run(id, agentId, userId, assignedBy ?? null);
}

export function unassignAgent(agentId: string, userId: string): void {
  getDb().prepare("DELETE FROM agent_assignments WHERE agent_id = ? AND user_id = ?").run(agentId, userId);
}

export function getAgentAssignments(agentId: string): string[] {
  const rows = getDb()
    .prepare("SELECT user_id FROM agent_assignments WHERE agent_id = ?")
    .all(agentId) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

export function getUserAssignedAgents(userId: string, companyId: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT aa.agent_id FROM agent_assignments aa
       JOIN agents a ON aa.agent_id = a.id
       WHERE aa.user_id = ? AND a.company_id = ?`
    )
    .all(userId, companyId) as { agent_id: string }[];
  return rows.map((r) => r.agent_id);
}

// ─── Debriefs ────────────────────────────────────────────
export interface Debrief {
  id: string;
  company_id: string;
  user_id: string;
  content: string;
  delivered_via: string | null;
  period_start: string;
  period_end: string;
  created_at: string;
}

export function createDebrief(data: {
  company_id: string;
  user_id: string;
  content: string;
  period_start: string;
  period_end: string;
  delivered_via?: string;
}): Debrief {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO debriefs (id, company_id, user_id, content, period_start, period_end, delivered_via)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.company_id, data.user_id, data.content, data.period_start, data.period_end, data.delivered_via ?? "dashboard");
  return db.prepare("SELECT * FROM debriefs WHERE id = ?").get(id) as Debrief;
}

export function getLatestDebrief(companyId: string): Debrief | undefined {
  return getDb()
    .prepare("SELECT * FROM debriefs WHERE company_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(companyId) as Debrief | undefined;
}

export function getTodaysDebrief(companyId: string): Debrief | undefined {
  return getDb()
    .prepare("SELECT * FROM debriefs WHERE company_id = ? AND date(created_at) = date('now') LIMIT 1")
    .get(companyId) as Debrief | undefined;
}

// ─── File Uploads ────────────────────────────────────────
export interface FileUpload {
  id: string;
  user_id: string | null;
  company_id: string | null;
  agent_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  category: string;
  created_at: string;
}

export function createFileUpload(data: {
  id: string;
  user_id: string;
  company_id?: string;
  agent_id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  category?: string;
}): FileUpload {
  const db = getDb();
  db.prepare(
    `INSERT INTO file_uploads (id, user_id, company_id, agent_id, file_name, file_type, file_size, file_path, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.id,
    data.user_id,
    data.company_id ?? null,
    data.agent_id ?? null,
    data.file_name,
    data.file_type,
    data.file_size,
    data.file_path,
    data.category ?? "other"
  );
  return db.prepare("SELECT * FROM file_uploads WHERE id = ?").get(data.id) as FileUpload;
}

export function getFileUpload(id: string): FileUpload | undefined {
  return getDb()
    .prepare("SELECT * FROM file_uploads WHERE id = ?")
    .get(id) as FileUpload | undefined;
}

export function getFilesByCompany(companyId: string): FileUpload[] {
  return getDb()
    .prepare("SELECT * FROM file_uploads WHERE company_id = ? ORDER BY created_at DESC")
    .all(companyId) as FileUpload[];
}

export function getFilesByAgent(agentId: string): FileUpload[] {
  return getDb()
    .prepare("SELECT * FROM file_uploads WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId) as FileUpload[];
}

export function deleteFileUpload(id: string): void {
  getDb().prepare("DELETE FROM file_uploads WHERE id = ?").run(id);
}

export function getStorageUsageByCompany(companyId: string): number {
  const result = getDb()
    .prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM file_uploads WHERE company_id = ?")
    .get(companyId) as { total: number };
  return result.total;
}

// ─── Webhooks ─────────────────────────────────────────────
export interface Webhook {
  id: string;
  company_id: string;
  agent_id: string;
  name: string;
  description: string | null;
  secret: string | null;
  task_type: string;
  task_title_template: string;
  is_active: number;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
}

export function createWebhook(data: {
  company_id: string;
  agent_id: string;
  name: string;
  description?: string;
  secret?: string;
  task_type?: string;
  task_title_template?: string;
}): Webhook {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO webhooks (id, company_id, agent_id, name, description, secret, task_type, task_title_template)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.company_id,
    data.agent_id,
    data.name,
    data.description ?? null,
    data.secret ?? null,
    data.task_type ?? "webhook",
    data.task_title_template ?? "Webhook: {name}"
  );
  return db.prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as Webhook;
}

export function getWebhook(id: string): Webhook | undefined {
  return getDb()
    .prepare("SELECT * FROM webhooks WHERE id = ?")
    .get(id) as Webhook | undefined;
}

export function getWebhooksByCompany(companyId: string): Webhook[] {
  return getDb()
    .prepare("SELECT * FROM webhooks WHERE company_id = ? ORDER BY created_at DESC")
    .all(companyId) as Webhook[];
}

export function incrementWebhookTrigger(id: string): void {
  getDb()
    .prepare(
      `UPDATE webhooks SET trigger_count = trigger_count + 1, last_triggered_at = datetime('now') WHERE id = ?`
    )
    .run(id);
}

export function deactivateWebhook(id: string): void {
  getDb()
    .prepare("UPDATE webhooks SET is_active = 0 WHERE id = ?")
    .run(id);
}

// ─── User API Keys (External Service Keys) ──────────────
export interface UserApiKey {
  id: string;
  company_id: string;
  service_name: string;
  display_name: string;
  is_active: number;
  last_used_at: string | null;
  created_at: string;
}

export function storeUserApiKey(
  companyId: string,
  serviceName: string,
  displayName: string,
  apiKey: string,
  config?: Record<string, unknown>
): UserApiKey {
  const db = getDb();
  const id = randomUUID();
  // MVP: store plain text — production would use encryption
  db.prepare(
    `INSERT INTO user_api_keys (id, company_id, service_name, display_name, api_key_encrypted, config_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_id, service_name)
     DO UPDATE SET display_name = excluded.display_name, api_key_encrypted = excluded.api_key_encrypted, config_json = excluded.config_json, is_active = 1`
  ).run(id, companyId, serviceName, displayName, apiKey, config ? JSON.stringify(config) : null);
  return db
    .prepare("SELECT id, company_id, service_name, display_name, is_active, last_used_at, created_at FROM user_api_keys WHERE company_id = ? AND service_name = ?")
    .get(companyId, serviceName) as UserApiKey;
}

export function getUserApiKey(companyId: string, serviceName: string): string | undefined {
  const row = getDb()
    .prepare("SELECT api_key_encrypted FROM user_api_keys WHERE company_id = ? AND service_name = ? AND is_active = 1")
    .get(companyId, serviceName) as { api_key_encrypted: string } | undefined;
  return row?.api_key_encrypted;
}

export function getUserApiKeys(companyId: string): UserApiKey[] {
  return getDb()
    .prepare("SELECT id, company_id, service_name, display_name, is_active, last_used_at, created_at FROM user_api_keys WHERE company_id = ? ORDER BY created_at DESC")
    .all(companyId) as UserApiKey[];
}

export function deleteUserApiKey(companyId: string, serviceName: string): void {
  getDb()
    .prepare("DELETE FROM user_api_keys WHERE company_id = ? AND service_name = ?")
    .run(companyId, serviceName);
}

export function updateUserApiKeyLastUsed(companyId: string, serviceName: string): void {
  getDb()
    .prepare("UPDATE user_api_keys SET last_used_at = datetime('now') WHERE company_id = ? AND service_name = ?")
    .run(companyId, serviceName);
}

// ─── Batch Queries (for agent status page) ──────────────────

export function getMemoryByAgentIds(agentIds: string[]): Record<string, MemoryEntry[]> {
  if (agentIds.length === 0) return {};
  const placeholders = agentIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT * FROM memory WHERE agent_id IN (${placeholders}) ORDER BY updated_at DESC`)
    .all(...agentIds) as (MemoryEntry & { agent_id: string })[];
  const result: Record<string, MemoryEntry[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    if (result[row.agent_id] && result[row.agent_id].length < 20) {
      result[row.agent_id].push(row);
    }
  }
  return result;
}

export function getCustomSkillsByAgentIds(agentIds: string[]): Record<string, string[]> {
  if (agentIds.length === 0) return {};
  const placeholders = agentIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT agent_id, skill FROM agent_custom_skills WHERE agent_id IN (${placeholders}) ORDER BY created_at`)
    .all(...agentIds) as { agent_id: string; skill: string }[];
  const result: Record<string, string[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    result[row.agent_id]?.push(row.skill);
  }
  return result;
}

export function getTasksByAgentIds(agentIds: string[]): Record<string, Task[]> {
  if (agentIds.length === 0) return {};
  const placeholders = agentIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT * FROM tasks WHERE agent_id IN (${placeholders}) ORDER BY created_at DESC`)
    .all(...agentIds) as (Task & { agent_id: string })[];
  const result: Record<string, Task[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    result[row.agent_id]?.push(row);
  }
  return result;
}

export function getActionsByAgentIds(agentIds: string[], limit = 10): Record<string, AgentAction[]> {
  if (agentIds.length === 0) return {};
  const placeholders = agentIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT * FROM agent_actions WHERE agent_id IN (${placeholders}) ORDER BY created_at DESC`)
    .all(...agentIds) as AgentAction[];
  const result: Record<string, AgentAction[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    if (result[row.agent_id] && result[row.agent_id].length < limit) {
      result[row.agent_id].push(row);
    }
  }
  return result;
}

export function getConversationCountsByAgentIds(agentIds: string[]): Record<string, { conversations: number; messages: number }> {
  if (agentIds.length === 0) return {};
  const placeholders = agentIds.map(() => "?").join(",");
  const convRows = getDb()
    .prepare(`SELECT agent_id, COUNT(*) as cnt FROM conversations WHERE agent_id IN (${placeholders}) GROUP BY agent_id`)
    .all(...agentIds) as { agent_id: string; cnt: number }[];
  const msgRows = getDb()
    .prepare(`SELECT c.agent_id, COUNT(m.id) as cnt FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.agent_id IN (${placeholders}) GROUP BY c.agent_id`)
    .all(...agentIds) as { agent_id: string; cnt: number }[];

  const result: Record<string, { conversations: number; messages: number }> = {};
  for (const id of agentIds) result[id] = { conversations: 0, messages: 0 };
  for (const row of convRows) result[row.agent_id] = { ...result[row.agent_id], conversations: row.cnt };
  for (const row of msgRows) result[row.agent_id] = { ...result[row.agent_id], messages: row.cnt };
  return result;
}
