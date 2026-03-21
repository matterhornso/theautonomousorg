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
