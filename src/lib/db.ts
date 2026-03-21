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

const DB_PATH = path.join(process.cwd(), "data", "autonomous.db");

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
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
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
  `);
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
