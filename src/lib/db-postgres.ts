/**
 * Postgres database layer (drop-in async replacement for db-sqlite.ts)
 *
 * Activated automatically when DATABASE_URL is set.
 * All functions are async and match the signatures in db.ts.
 */

import postgres from "postgres";
import { randomUUID, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import type {
  Company,
  Agent,
  Conversation,
  Message,
  MemoryEntry,
} from "./types";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    "DATABASE_URL not set — Postgres database layer will fail. Set it in .env.local."
  );
}

const sql = DATABASE_URL
  ? postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  : (null as unknown as ReturnType<typeof postgres>);

// ─── Schema Migration ────────────────────────────────────
export async function initSchema() {
  if (!sql) throw new Error("DATABASE_URL not configured");

  await sql`
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      industry TEXT,
      description TEXT,
      stage TEXT,
      analysis_json TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      role TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      company_context TEXT,
      skills_json TEXT,
      connectors_json TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 1000,
      total_earned INTEGER NOT NULL DEFAULT 1000,
      total_spent INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      balance_after INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_custom_skills (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      skill TEXT NOT NULL,
      added_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(agent_id, skill)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_actions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      source TEXT DEFAULT 'system',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS memory (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(agent_id, key)
    )`;

  await sql`
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
      scheduled_at TIMESTAMPTZ,
      cron_expression TEXT,
      is_recurring INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )`;

  await sql`
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_at TIMESTAMPTZ
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_assignments (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      user_id TEXT NOT NULL,
      assigned_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(agent_id, user_id)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS debriefs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      delivered_via TEXT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) UNIQUE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      month TEXT NOT NULL,
      task_count INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      UNIQUE(company_id, month)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS inter_agent_messages (
      id TEXT PRIMARY KEY,
      source_agent_id TEXT NOT NULL REFERENCES agents(id),
      target_agent_id TEXT NOT NULL REFERENCES agents(id),
      request TEXT NOT NULL,
      response TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      conversation_id TEXT REFERENCES conversations(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS messaging_users (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      platform TEXT NOT NULL,
      platform_user_id TEXT NOT NULL,
      display_name TEXT,
      default_agent_id TEXT REFERENCES agents(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, platform_user_id)
    )`;

  await sql`
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      service_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      config_json TEXT,
      is_active INTEGER DEFAULT 1,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, service_name)
    )`;

  await sql`
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
      last_triggered_at TIMESTAMPTZ,
      trigger_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS chai_time_sessions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      agent_summaries TEXT,
      cross_updates TEXT,
      status TEXT DEFAULT 'running'
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS chai_time_config (
      company_id TEXT PRIMARY KEY REFERENCES companies(id),
      enabled INTEGER DEFAULT 1,
      time_hour INTEGER DEFAULT 17,
      time_minute INTEGER DEFAULT 0,
      timezone TEXT DEFAULT 'UTC',
      last_run_at TIMESTAMPTZ
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      description TEXT,
      trigger_agent_role TEXT NOT NULL,
      trigger_event TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_triggered_at TIMESTAMPTZ,
      trigger_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      company_id TEXT NOT NULL REFERENCES companies(id),
      status TEXT NOT NULL DEFAULT 'running',
      current_step INTEGER DEFAULT 0,
      results_json TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_evals (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      conversation_id TEXT,
      message_id TEXT,
      eval_type TEXT NOT NULL,
      scores TEXT NOT NULL,
      judge_reasoning TEXT,
      user_feedback TEXT,
      prompt_used TEXT,
      response_evaluated TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS eval_test_suites (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      test_name TEXT NOT NULL,
      test_prompt TEXT NOT NULL,
      expected_qualities TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS eval_runs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      run_type TEXT NOT NULL,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      results TEXT,
      status TEXT DEFAULT 'running'
    )`;

  // Create indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_company ON agents(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory(agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_actions_agent ON agent_actions(agent_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_team_members_company ON team_members(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_debriefs_company ON debriefs(company_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chai_time_sessions_company ON chai_time_sessions(company_id, started_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_workflows_company ON workflows(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_workflow_runs_company ON workflow_runs(company_id, started_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_content ON messages USING gin(to_tsvector('english', content))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_evals_agent ON agent_evals(agent_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_company ON eval_runs(company_id, started_at)`;
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

export async function getChaiTimeConfig(companyId: string): Promise<ChaiTimeConfig> {
  const [existing] = await sql`SELECT * FROM chai_time_config WHERE company_id = ${companyId}`;
  if (existing) return existing as ChaiTimeConfig;
  const [row] = await sql`
    INSERT INTO chai_time_config (company_id) VALUES (${companyId})
    RETURNING *`;
  return row as ChaiTimeConfig;
}

export async function updateChaiTimeConfig(
  companyId: string,
  config: { enabled?: number; time_hour?: number; time_minute?: number; timezone?: string; last_run_at?: string }
): Promise<void> {
  await getChaiTimeConfig(companyId);
  if (config.enabled !== undefined) await sql`UPDATE chai_time_config SET enabled = ${config.enabled} WHERE company_id = ${companyId}`;
  if (config.time_hour !== undefined) await sql`UPDATE chai_time_config SET time_hour = ${config.time_hour} WHERE company_id = ${companyId}`;
  if (config.time_minute !== undefined) await sql`UPDATE chai_time_config SET time_minute = ${config.time_minute} WHERE company_id = ${companyId}`;
  if (config.timezone !== undefined) await sql`UPDATE chai_time_config SET timezone = ${config.timezone} WHERE company_id = ${companyId}`;
  if (config.last_run_at !== undefined) await sql`UPDATE chai_time_config SET last_run_at = ${config.last_run_at} WHERE company_id = ${companyId}`;
}

export async function createChaiTimeSession(companyId: string): Promise<ChaiTimeSession> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO chai_time_sessions (id, company_id) VALUES (${id}, ${companyId})
    RETURNING *`;
  return row as ChaiTimeSession;
}

export async function updateChaiTimeSession(
  sessionId: string,
  data: { agent_summaries?: string; cross_updates?: string; status?: string; completed_at?: string }
): Promise<void> {
  if (data.agent_summaries !== undefined) await sql`UPDATE chai_time_sessions SET agent_summaries = ${data.agent_summaries} WHERE id = ${sessionId}`;
  if (data.cross_updates !== undefined) await sql`UPDATE chai_time_sessions SET cross_updates = ${data.cross_updates} WHERE id = ${sessionId}`;
  if (data.status !== undefined) await sql`UPDATE chai_time_sessions SET status = ${data.status} WHERE id = ${sessionId}`;
  if (data.completed_at !== undefined) await sql`UPDATE chai_time_sessions SET completed_at = ${data.completed_at} WHERE id = ${sessionId}`;
}

export async function getLatestChaiTimeSession(companyId: string): Promise<ChaiTimeSession | undefined> {
  const [row] = await sql`SELECT * FROM chai_time_sessions WHERE company_id = ${companyId} ORDER BY started_at DESC LIMIT 1`;
  return row as ChaiTimeSession | undefined;
}

export async function getChaiTimeSessions(companyId: string, limit = 7): Promise<ChaiTimeSession[]> {
  return (await sql`SELECT * FROM chai_time_sessions WHERE company_id = ${companyId} ORDER BY started_at DESC LIMIT ${limit}`) as ChaiTimeSession[];
}

// ─── Companies ───────────────────────────────────────────
export async function createCompany(data: {
  name: string;
  url: string;
  user_id?: string;
  industry?: string;
  description?: string;
  stage?: string;
  analysis_json?: string;
}): Promise<Company> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO companies (id, user_id, name, url, industry, description, stage, analysis_json)
    VALUES (${id}, ${data.user_id ?? null}, ${data.name}, ${data.url},
            ${data.industry ?? null}, ${data.description ?? null},
            ${data.stage ?? null}, ${data.analysis_json ?? null})
    RETURNING *`;
  return row as Company;
}

export async function getCompany(id: string): Promise<Company | undefined> {
  const [row] = await sql`SELECT * FROM companies WHERE id = ${id}`;
  return row as Company | undefined;
}

export async function getCompaniesByUser(userId: string): Promise<Company[]> {
  return (await sql`SELECT * FROM companies WHERE user_id = ${userId} ORDER BY created_at DESC`) as Company[];
}

export async function claimCompanyForUser(companyId: string, userId: string): Promise<void> {
  await sql`UPDATE companies SET user_id = ${userId} WHERE id = ${companyId} AND user_id IS NULL`;
}

// ─── Agents ──────────────────────────────────────────────
export async function createAgent(data: {
  company_id: string;
  role: string;
  system_prompt: string;
  company_context?: string;
  skills_json?: string;
  connectors_json?: string;
}): Promise<Agent> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO agents (id, company_id, role, system_prompt, company_context, skills_json, connectors_json)
    VALUES (${id}, ${data.company_id}, ${data.role}, ${data.system_prompt},
            ${data.company_context ?? null}, ${data.skills_json ?? null},
            ${data.connectors_json ?? null})
    RETURNING *`;
  return row as Agent;
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  const [row] = await sql`SELECT * FROM agents WHERE id = ${id}`;
  return row as Agent | undefined;
}

export async function getAgentsByCompany(companyId: string): Promise<Agent[]> {
  return (await sql`SELECT * FROM agents WHERE company_id = ${companyId} ORDER BY created_at`) as Agent[];
}

export async function getAgentRoster(companyId: string): Promise<{ role: string; id: string }[]> {
  return (await sql`SELECT id, role FROM agents WHERE company_id = ${companyId} AND status = 'active'`) as { role: string; id: string }[];
}

// ─── Conversations ───────────────────────────────────────
export async function createConversation(agentId: string, title?: string): Promise<Conversation> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO conversations (id, agent_id, title) VALUES (${id}, ${agentId}, ${title ?? null})
    RETURNING *`;
  return row as Conversation;
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const [row] = await sql`SELECT * FROM conversations WHERE id = ${id}`;
  return row as Conversation | undefined;
}

export async function getConversationsByAgent(agentId: string): Promise<Conversation[]> {
  return (await sql`SELECT * FROM conversations WHERE agent_id = ${agentId} ORDER BY updated_at DESC`) as Conversation[];
}

// ─── Messages ────────────────────────────────────────────
export async function addMessage(data: {
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
}): Promise<Message> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO messages (id, conversation_id, role, content)
    VALUES (${id}, ${data.conversation_id}, ${data.role}, ${data.content})
    RETURNING *`;
  await sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${data.conversation_id}`;
  return row as Message;
}

export async function getMessages(conversationId: string, limit = 50): Promise<Message[]> {
  return (await sql`
    SELECT * FROM messages WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC LIMIT ${limit}`) as Message[];
}

// ─── Memory ──────────────────────────────────────────────
export async function getMemory(agentId: string): Promise<MemoryEntry[]> {
  return (await sql`
    SELECT * FROM memory WHERE agent_id = ${agentId}
    ORDER BY updated_at DESC LIMIT 20`) as MemoryEntry[];
}

export async function setMemory(agentId: string, key: string, value: string): Promise<void> {
  const id = randomUUID();
  await sql`
    INSERT INTO memory (id, agent_id, key, value)
    VALUES (${id}, ${agentId}, ${key}, ${value})
    ON CONFLICT (agent_id, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
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

export async function getUserProfile(userId: string): Promise<UserProfile | undefined> {
  const [row] = await sql`SELECT * FROM user_profiles WHERE user_id = ${userId}`;
  return row as UserProfile | undefined;
}

export async function upsertUserProfile(
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
): Promise<UserProfile> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO user_profiles (id, user_id, full_name, role_title, company_name, company_website, company_size, industry, current_tools, biggest_challenges, automation_goals)
    VALUES (${id}, ${userId}, ${data.full_name ?? null}, ${data.role_title ?? null},
            ${data.company_name ?? null}, ${data.company_website ?? null},
            ${data.company_size ?? null}, ${data.industry ?? null},
            ${data.current_tools ?? null}, ${data.biggest_challenges ?? null},
            ${data.automation_goals ?? null})
    ON CONFLICT (user_id)
    DO UPDATE SET
      full_name = COALESCE(${data.full_name ?? null}, user_profiles.full_name),
      role_title = COALESCE(${data.role_title ?? null}, user_profiles.role_title),
      company_name = COALESCE(${data.company_name ?? null}, user_profiles.company_name),
      company_website = COALESCE(${data.company_website ?? null}, user_profiles.company_website),
      company_size = COALESCE(${data.company_size ?? null}, user_profiles.company_size),
      industry = COALESCE(${data.industry ?? null}, user_profiles.industry),
      current_tools = COALESCE(${data.current_tools ?? null}, user_profiles.current_tools),
      biggest_challenges = COALESCE(${data.biggest_challenges ?? null}, user_profiles.biggest_challenges),
      automation_goals = COALESCE(${data.automation_goals ?? null}, user_profiles.automation_goals),
      updated_at = NOW()
    RETURNING *`;
  return row as UserProfile;
}

// ─── Credits ─────────────────────────────────────────────
export const CREDITS_PER_PROMPT = 50;
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

export async function getCredits(userId: string): Promise<CreditBalance> {
  const [existing] = await sql`SELECT * FROM credits WHERE user_id = ${userId}`;
  if (existing) return existing as CreditBalance;

  // Auto-create with signup bonus
  const id = randomUUID();
  await sql`
    INSERT INTO credits (id, user_id, balance, total_earned, total_spent)
    VALUES (${id}, ${userId}, ${SIGNUP_CREDITS}, ${SIGNUP_CREDITS}, 0)`;

  const txId = randomUUID();
  await sql`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after)
    VALUES (${txId}, ${userId}, ${SIGNUP_CREDITS}, 'signup', 'Welcome bonus — 1000 free credits', ${SIGNUP_CREDITS})`;

  const [row] = await sql`SELECT * FROM credits WHERE user_id = ${userId}`;
  return row as CreditBalance;
}

export async function hasEnoughCredits(userId: string, cost: number = CREDITS_PER_PROMPT): Promise<boolean> {
  const credits = await getCredits(userId);
  return credits.balance >= cost;
}

export async function deductCredits(
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; balance: number }> {
  const credits = await getCredits(userId);
  if (credits.balance < amount) {
    return { success: false, balance: credits.balance };
  }

  const newBalance = credits.balance - amount;
  await sql`
    UPDATE credits SET balance = ${newBalance}, total_spent = total_spent + ${amount}, updated_at = NOW()
    WHERE user_id = ${userId}`;

  const txId = randomUUID();
  await sql`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after)
    VALUES (${txId}, ${userId}, ${-amount}, 'usage', ${description}, ${newBalance})`;

  return { success: true, balance: newBalance };
}

export async function addCredits(
  userId: string,
  amount: number,
  type: "topup" | "refund",
  description: string
): Promise<number> {
  const credits = await getCredits(userId);
  const newBalance = credits.balance + amount;

  await sql`
    UPDATE credits SET balance = ${newBalance}, total_earned = total_earned + ${amount}, updated_at = NOW()
    WHERE user_id = ${userId}`;

  const txId = randomUUID();
  await sql`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after)
    VALUES (${txId}, ${userId}, ${amount}, ${type}, ${description}, ${newBalance})`;

  return newBalance;
}

export async function getCreditTransactions(userId: string, limit = 20): Promise<CreditTransaction[]> {
  return (await sql`
    SELECT * FROM credit_transactions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`) as CreditTransaction[];
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

export async function logAgentAction(data: {
  agent_id: string;
  action_type: string;
  title: string;
  detail?: string;
  source?: string;
}): Promise<void> {
  const id = randomUUID();
  await sql`
    INSERT INTO agent_actions (id, agent_id, action_type, title, detail, source)
    VALUES (${id}, ${data.agent_id}, ${data.action_type}, ${data.title}, ${data.detail ?? null}, ${data.source ?? "system"})`;
}

export async function getAgentActions(agentId: string, limit = 20): Promise<AgentAction[]> {
  return (await sql`SELECT * FROM agent_actions WHERE agent_id = ${agentId} ORDER BY created_at DESC LIMIT ${limit}`) as AgentAction[];
}

export async function getCompanyActions(companyId: string, limit = 50): Promise<AgentAction[]> {
  return (await sql`
    SELECT aa.* FROM agent_actions aa
    JOIN agents a ON aa.agent_id = a.id
    WHERE a.company_id = ${companyId}
    ORDER BY aa.created_at DESC LIMIT ${limit}`) as AgentAction[];
}

// ─── Agent Custom Skills ─────────────────────────────────
export async function getCustomSkills(agentId: string): Promise<string[]> {
  const rows = await sql`SELECT skill FROM agent_custom_skills WHERE agent_id = ${agentId} ORDER BY created_at`;
  return (rows as unknown as { skill: string }[]).map((r) => r.skill);
}

export async function addCustomSkill(agentId: string, skill: string, addedBy?: string): Promise<void> {
  const id = randomUUID();
  await sql`
    INSERT INTO agent_custom_skills (id, agent_id, skill, added_by)
    VALUES (${id}, ${agentId}, ${skill}, ${addedBy ?? null})
    ON CONFLICT (agent_id, skill) DO NOTHING`;
}

export async function removeCustomSkill(agentId: string, skill: string): Promise<void> {
  await sql`DELETE FROM agent_custom_skills WHERE agent_id = ${agentId} AND skill = ${skill}`;
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

export async function createApiKey(companyId: string, keyHash: string, name: string): Promise<ApiKey> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO api_keys (id, company_id, key_hash, name)
    VALUES (${id}, ${companyId}, ${keyHash}, ${name})
    RETURNING *`;
  return row as ApiKey;
}

export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
  const [row] = await sql`SELECT * FROM api_keys WHERE key_hash = ${keyHash}`;
  if (row) {
    await sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${(row as ApiKey).id}`;
  }
  return row as ApiKey | undefined;
}

export async function getApiKeysByCompany(companyId: string): Promise<ApiKey[]> {
  return (await sql`SELECT * FROM api_keys WHERE company_id = ${companyId} ORDER BY created_at DESC`) as ApiKey[];
}

export async function deleteApiKey(id: string): Promise<void> {
  await sql`DELETE FROM api_keys WHERE id = ${id}`;
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

export async function getSubscription(companyId: string): Promise<Subscription | undefined> {
  const [row] = await sql`SELECT * FROM subscriptions WHERE company_id = ${companyId}`;
  return row as Subscription | undefined;
}

export async function upsertSubscription(
  companyId: string,
  data: Partial<Omit<Subscription, "id" | "company_id" | "created_at" | "updated_at">>
): Promise<Subscription> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO subscriptions (id, company_id, plan, status, stripe_customer_id, stripe_subscription_id)
    VALUES (${id}, ${companyId}, ${data.plan || "free"}, ${data.status || "active"},
            ${data.stripe_customer_id ?? null}, ${data.stripe_subscription_id ?? null})
    ON CONFLICT (company_id)
    DO UPDATE SET
      plan = COALESCE(${data.plan ?? null}, subscriptions.plan),
      status = COALESCE(${data.status ?? null}, subscriptions.status),
      stripe_customer_id = COALESCE(${data.stripe_customer_id ?? null}, subscriptions.stripe_customer_id),
      stripe_subscription_id = COALESCE(${data.stripe_subscription_id ?? null}, subscriptions.stripe_subscription_id),
      current_period_end = COALESCE(${data.current_period_end ?? null}, subscriptions.current_period_end),
      updated_at = NOW()
    RETURNING *`;
  return row as Subscription;
}

export async function getUsage(companyId: string): Promise<{ task_count: number; message_count: number }> {
  const month = new Date().toISOString().slice(0, 7);
  const [row] = await sql`
    SELECT COALESCE(SUM(task_count), 0) as task_count, COALESCE(SUM(message_count), 0) as message_count
    FROM usage_records WHERE company_id = ${companyId} AND month = ${month}`;
  return { task_count: Number(row?.task_count || 0), message_count: Number(row?.message_count || 0) };
}

export async function incrementUsage(companyId: string, field: "task_count" | "message_count"): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  const id = randomUUID();
  if (field === "task_count") {
    await sql`
      INSERT INTO usage_records (id, company_id, month, task_count)
      VALUES (${id}, ${companyId}, ${month}, 1)
      ON CONFLICT (company_id, month)
      DO UPDATE SET task_count = usage_records.task_count + 1`;
  } else {
    await sql`
      INSERT INTO usage_records (id, company_id, month, message_count)
      VALUES (${id}, ${companyId}, ${month}, 1)
      ON CONFLICT (company_id, month)
      DO UPDATE SET message_count = usage_records.message_count + 1`;
  }
}

export async function checkPlanLimits(companyId: string): Promise<{
  canProvision: boolean;
  canCreateTask: boolean;
  plan: string;
  agentCount: number;
  agentLimit: number;
  taskCount: number;
  taskLimit: number;
}> {
  const sub = await getSubscription(companyId);
  const plan = sub?.plan || "free";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const agents = await getAgentsByCompany(companyId);
  const usage = await getUsage(companyId);

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

export async function createTask(data: {
  agent_id: string;
  type: string;
  title: string;
  input_json?: string;
}): Promise<Task> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO tasks (id, agent_id, type, title, input_json)
    VALUES (${id}, ${data.agent_id}, ${data.type}, ${data.title}, ${data.input_json ?? null})
    RETURNING *`;
  return row as Task;
}

export async function getTasksByAgent(agentId: string): Promise<Task[]> {
  return (await sql`SELECT * FROM tasks WHERE agent_id = ${agentId} ORDER BY created_at DESC`) as Task[];
}

export async function getTasksByCompany(companyId: string): Promise<Task[]> {
  return (await sql`
    SELECT t.* FROM tasks t
    JOIN agents a ON t.agent_id = a.id
    WHERE a.company_id = ${companyId}
    ORDER BY t.created_at DESC`) as Task[];
}

export async function getNextQueuedTask(): Promise<Task | undefined> {
  const [row] = await sql`
    SELECT * FROM tasks WHERE status = 'queued'
    ORDER BY created_at ASC LIMIT 1
    FOR UPDATE SKIP LOCKED`;
  return row as Task | undefined;
}

export async function updateTaskStatus(
  id: string,
  status: "running" | "done" | "failed",
  result?: { result_json?: string; error_message?: string }
): Promise<void> {
  if (status === "done") {
    await sql`UPDATE tasks SET status = 'done', result_json = ${result?.result_json ?? null}, completed_at = NOW() WHERE id = ${id}`;
  } else if (status === "failed") {
    await sql`UPDATE tasks SET status = 'failed', error_message = ${result?.error_message ?? "Unknown error"}, retry_count = retry_count + 1, completed_at = NOW() WHERE id = ${id}`;
  } else {
    await sql`UPDATE tasks SET status = 'running' WHERE id = ${id}`;
  }
}

export async function requeueFailedTask(id: string): Promise<void> {
  await sql`UPDATE tasks SET status = 'queued', error_message = NULL WHERE id = ${id}`;
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

export async function createInterAgentMessage(data: {
  source_agent_id: string;
  target_agent_id: string;
  request: string;
  conversation_id?: string;
}): Promise<InterAgentMessage> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO inter_agent_messages (id, source_agent_id, target_agent_id, request, conversation_id)
    VALUES (${id}, ${data.source_agent_id}, ${data.target_agent_id}, ${data.request}, ${data.conversation_id ?? null})
    RETURNING *`;
  return row as InterAgentMessage;
}

export async function completeInterAgentMessage(id: string, response: string): Promise<void> {
  await sql`UPDATE inter_agent_messages SET response = ${response}, status = 'done', completed_at = NOW() WHERE id = ${id}`;
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

export async function getActivityFeed(companyId: string, limit = 20): Promise<ActivityItem[]> {
  return (await sql`
    SELECT * FROM (
      SELECT 'task' as type, a.role as agent_role, a.id as agent_id,
             t.title, t.status,
             CASE WHEN t.result_json IS NOT NULL THEN LEFT(t.result_json, 200) ELSE NULL END as detail,
             t.created_at
      FROM tasks t JOIN agents a ON t.agent_id = a.id
      WHERE a.company_id = ${companyId}
      UNION ALL
      SELECT 'relay' as type, sa.role as agent_role, sa.id as agent_id,
             'Asked @' || ta.role || ': ' || LEFT(iam.request, 80) as title,
             iam.status,
             CASE WHEN iam.response IS NOT NULL THEN LEFT(iam.response, 200) ELSE NULL END as detail,
             iam.created_at
      FROM inter_agent_messages iam
      JOIN agents sa ON iam.source_agent_id = sa.id
      JOIN agents ta ON iam.target_agent_id = ta.id
      WHERE sa.company_id = ${companyId}
    ) combined ORDER BY created_at DESC LIMIT ${limit}`) as ActivityItem[];
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

export async function getMessagingUser(platform: string, platformUserId: string): Promise<MessagingUser | undefined> {
  const [row] = await sql`SELECT * FROM messaging_users WHERE platform = ${platform} AND platform_user_id = ${platformUserId}`;
  return row as MessagingUser | undefined;
}

export async function createMessagingUser(data: {
  company_id: string;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  default_agent_id?: string;
}): Promise<MessagingUser> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO messaging_users (id, company_id, platform, platform_user_id, display_name, default_agent_id)
    VALUES (${id}, ${data.company_id}, ${data.platform}, ${data.platform_user_id},
            ${data.display_name ?? null}, ${data.default_agent_id ?? null})
    RETURNING *`;
  return row as MessagingUser;
}

export async function updateDefaultAgent(id: string, agentId: string): Promise<void> {
  await sql`UPDATE messaging_users SET default_agent_id = ${agentId} WHERE id = ${id}`;
}

// ─── Scheduled Tasks ─────────────────────────────────────
export async function createScheduledTask(data: {
  agent_id: string;
  type: string;
  title: string;
  input_json?: string;
  scheduled_at?: string;
  cron_expression?: string;
  is_recurring?: boolean;
}): Promise<Task> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO tasks (id, agent_id, type, title, input_json, scheduled_at, cron_expression, is_recurring, status)
    VALUES (${id}, ${data.agent_id}, ${data.type}, ${data.title},
            ${data.input_json ?? null}, ${data.scheduled_at ?? null},
            ${data.cron_expression ?? null}, ${data.is_recurring ? 1 : 0}, 'queued')
    RETURNING *`;
  return row as Task;
}

export async function getScheduledDueTasks(): Promise<Task[]> {
  return (await sql`
    SELECT * FROM tasks WHERE is_recurring = 1 AND scheduled_at IS NOT NULL
    AND scheduled_at <= NOW() AND status = 'queued'
    ORDER BY scheduled_at ASC LIMIT 5`) as Task[];
}

export async function getScheduledTasksByCompany(companyId: string): Promise<Task[]> {
  return (await sql`
    SELECT t.* FROM tasks t JOIN agents a ON t.agent_id = a.id
    WHERE a.company_id = ${companyId} AND (t.is_recurring = 1 OR t.scheduled_at IS NOT NULL)
    ORDER BY t.created_at DESC`) as Task[];
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

export async function createTeamMember(data: {
  company_id: string;
  email: string;
  phone?: string;
  role?: string;
  user_id?: string;
  invited_by?: string;
}): Promise<TeamMember> {
  const id = randomUUID();
  const token = randomUUID();
  const status = data.user_id ? "accepted" : "pending";
  const [row] = await sql`
    INSERT INTO team_members (id, company_id, user_id, email, phone, role, invite_status, invite_token, invited_by${data.user_id ? sql`, accepted_at` : sql``})
    VALUES (${id}, ${data.company_id}, ${data.user_id ?? null}, ${data.email},
            ${data.phone ?? null}, ${data.role || "member"}, ${status}, ${token},
            ${data.invited_by ?? null}${data.user_id ? sql`, NOW()` : sql``})
    RETURNING *`;
  return row as TeamMember;
}

export async function getTeamMembers(companyId: string): Promise<TeamMember[]> {
  return (await sql`SELECT * FROM team_members WHERE company_id = ${companyId} ORDER BY created_at`) as TeamMember[];
}

export async function getTeamMemberByUserId(companyId: string, userId: string): Promise<TeamMember | undefined> {
  const [row] = await sql`SELECT * FROM team_members WHERE company_id = ${companyId} AND user_id = ${userId}`;
  return row as TeamMember | undefined;
}

export async function acceptInvite(token: string, userId: string): Promise<TeamMember | undefined> {
  await sql`
    UPDATE team_members SET user_id = ${userId}, invite_status = 'accepted', accepted_at = NOW()
    WHERE invite_token = ${token} AND invite_status = 'pending'`;
  const [row] = await sql`SELECT * FROM team_members WHERE invite_token = ${token}`;
  return row as TeamMember | undefined;
}

export async function updateTeamMemberRole(id: string, role: string): Promise<void> {
  await sql`UPDATE team_members SET role = ${role} WHERE id = ${id}`;
}

export async function removeTeamMember(id: string): Promise<void> {
  await sql`DELETE FROM team_members WHERE id = ${id}`;
}

// ─── Agent Assignments ───────────────────────────────────
export async function assignAgent(agentId: string, userId: string, assignedBy?: string): Promise<void> {
  const id = randomUUID();
  await sql`
    INSERT INTO agent_assignments (id, agent_id, user_id, assigned_by)
    VALUES (${id}, ${agentId}, ${userId}, ${assignedBy ?? null})
    ON CONFLICT (agent_id, user_id) DO NOTHING`;
}

export async function unassignAgent(agentId: string, userId: string): Promise<void> {
  await sql`DELETE FROM agent_assignments WHERE agent_id = ${agentId} AND user_id = ${userId}`;
}

export async function getAgentAssignments(agentId: string): Promise<string[]> {
  const rows = await sql`SELECT user_id FROM agent_assignments WHERE agent_id = ${agentId}`;
  return (rows as unknown as { user_id: string }[]).map((r) => r.user_id);
}

export async function getUserAssignedAgents(userId: string, companyId: string): Promise<string[]> {
  const rows = await sql`
    SELECT aa.agent_id FROM agent_assignments aa
    JOIN agents a ON aa.agent_id = a.id
    WHERE aa.user_id = ${userId} AND a.company_id = ${companyId}`;
  return (rows as unknown as { agent_id: string }[]).map((r) => r.agent_id);
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

export async function createDebrief(data: {
  company_id: string;
  user_id: string;
  content: string;
  period_start: string;
  period_end: string;
  delivered_via?: string;
}): Promise<Debrief> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO debriefs (id, company_id, user_id, content, period_start, period_end, delivered_via)
    VALUES (${id}, ${data.company_id}, ${data.user_id}, ${data.content}, ${data.period_start}, ${data.period_end}, ${data.delivered_via ?? "dashboard"})
    RETURNING *`;
  return row as Debrief;
}

export async function getLatestDebrief(companyId: string): Promise<Debrief | undefined> {
  const [row] = await sql`SELECT * FROM debriefs WHERE company_id = ${companyId} ORDER BY created_at DESC LIMIT 1`;
  return row as Debrief | undefined;
}

export async function getTodaysDebrief(companyId: string): Promise<Debrief | undefined> {
  const [row] = await sql`SELECT * FROM debriefs WHERE company_id = ${companyId} AND DATE(created_at) = CURRENT_DATE LIMIT 1`;
  return row as Debrief | undefined;
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

export async function createFileUpload(data: {
  id: string;
  user_id: string;
  company_id?: string;
  agent_id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  category?: string;
}): Promise<FileUpload> {
  const [row] = await sql`
    INSERT INTO file_uploads (id, user_id, company_id, agent_id, file_name, file_type, file_size, file_path, category)
    VALUES (${data.id}, ${data.user_id}, ${data.company_id ?? null}, ${data.agent_id ?? null},
            ${data.file_name}, ${data.file_type}, ${data.file_size}, ${data.file_path}, ${data.category ?? "other"})
    RETURNING *`;
  return row as FileUpload;
}

export async function getFileUpload(id: string): Promise<FileUpload | undefined> {
  const [row] = await sql`SELECT * FROM file_uploads WHERE id = ${id}`;
  return row as FileUpload | undefined;
}

export async function getFilesByCompany(companyId: string): Promise<FileUpload[]> {
  return (await sql`SELECT * FROM file_uploads WHERE company_id = ${companyId} ORDER BY created_at DESC`) as FileUpload[];
}

export async function getFilesByAgent(agentId: string): Promise<FileUpload[]> {
  return (await sql`SELECT * FROM file_uploads WHERE agent_id = ${agentId} ORDER BY created_at DESC`) as FileUpload[];
}

export async function deleteFileUpload(id: string): Promise<void> {
  await sql`DELETE FROM file_uploads WHERE id = ${id}`;
}

export async function getStorageUsageByCompany(companyId: string): Promise<number> {
  const [row] = await sql`SELECT COALESCE(SUM(file_size), 0) as total FROM file_uploads WHERE company_id = ${companyId}`;
  return Number(row?.total || 0);
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

export async function createWebhook(data: {
  company_id: string;
  agent_id: string;
  name: string;
  description?: string;
  secret?: string;
  task_type?: string;
  task_title_template?: string;
}): Promise<Webhook> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO webhooks (id, company_id, agent_id, name, description, secret, task_type, task_title_template)
    VALUES (${id}, ${data.company_id}, ${data.agent_id}, ${data.name},
            ${data.description ?? null}, ${data.secret ?? null},
            ${data.task_type ?? "webhook"}, ${data.task_title_template ?? "Webhook: {name}"})
    RETURNING *`;
  return row as Webhook;
}

export async function getWebhook(id: string): Promise<Webhook | undefined> {
  const [row] = await sql`SELECT * FROM webhooks WHERE id = ${id}`;
  return row as Webhook | undefined;
}

export async function getWebhooksByCompany(companyId: string): Promise<Webhook[]> {
  return (await sql`SELECT * FROM webhooks WHERE company_id = ${companyId} ORDER BY created_at DESC`) as Webhook[];
}

export async function incrementWebhookTrigger(id: string): Promise<void> {
  await sql`UPDATE webhooks SET trigger_count = trigger_count + 1, last_triggered_at = NOW() WHERE id = ${id}`;
}

export async function deactivateWebhook(id: string): Promise<void> {
  await sql`UPDATE webhooks SET is_active = 0 WHERE id = ${id}`;
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

function getEncryptionKey(): Buffer | null {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) return null;
  return scryptSync(envKey, "theautonomous-salt", 32);
}

function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return Buffer.from(plaintext).toString("base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptApiKey(stored: string): string {
  const key = getEncryptionKey();
  if (!key) return Buffer.from(stored, "base64").toString("utf8");
  const parts = stored.split(":");
  if (parts.length !== 3) return stored; // legacy plaintext fallback
  const [ivHex, tagHex, encHex] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8");
}

export async function storeUserApiKey(
  companyId: string,
  serviceName: string,
  displayName: string,
  apiKey: string,
  config?: Record<string, unknown>
): Promise<UserApiKey> {
  const id = randomUUID();
  const encrypted = encryptApiKey(apiKey);
  await sql`
    INSERT INTO user_api_keys (id, company_id, service_name, display_name, api_key_encrypted, config_json)
    VALUES (${id}, ${companyId}, ${serviceName}, ${displayName}, ${encrypted}, ${config ? JSON.stringify(config) : null})
    ON CONFLICT (company_id, service_name)
    DO UPDATE SET display_name = EXCLUDED.display_name, api_key_encrypted = EXCLUDED.api_key_encrypted, config_json = EXCLUDED.config_json, is_active = 1`;
  const [row] = await sql`
    SELECT id, company_id, service_name, display_name, is_active, last_used_at, created_at
    FROM user_api_keys WHERE company_id = ${companyId} AND service_name = ${serviceName}`;
  return row as UserApiKey;
}

export async function getUserApiKey(companyId: string, serviceName: string): Promise<string | undefined> {
  const [row] = await sql`
    SELECT api_key_encrypted FROM user_api_keys
    WHERE company_id = ${companyId} AND service_name = ${serviceName} AND is_active = 1`;
  const stored = (row as { api_key_encrypted: string } | undefined)?.api_key_encrypted;
  return stored ? decryptApiKey(stored) : undefined;
}

export async function getUserApiKeys(companyId: string): Promise<UserApiKey[]> {
  return (await sql`
    SELECT id, company_id, service_name, display_name, is_active, last_used_at, created_at
    FROM user_api_keys WHERE company_id = ${companyId} ORDER BY created_at DESC`) as UserApiKey[];
}

export async function deleteUserApiKey(companyId: string, serviceName: string): Promise<void> {
  await sql`DELETE FROM user_api_keys WHERE company_id = ${companyId} AND service_name = ${serviceName}`;
}

export async function updateUserApiKeyLastUsed(companyId: string, serviceName: string): Promise<void> {
  await sql`UPDATE user_api_keys SET last_used_at = NOW() WHERE company_id = ${companyId} AND service_name = ${serviceName}`;
}

// ─── Batch Queries (for agent status page) ──────────────────
export async function getMemoryByAgentIds(agentIds: string[]): Promise<Record<string, MemoryEntry[]>> {
  if (agentIds.length === 0) return {};
  const rows = await sql`SELECT * FROM memory WHERE agent_id = ANY(${agentIds}) ORDER BY updated_at DESC`;
  const result: Record<string, MemoryEntry[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    const r = row as MemoryEntry & { agent_id: string };
    if (result[r.agent_id] && result[r.agent_id].length < 20) {
      result[r.agent_id].push(r);
    }
  }
  return result;
}

export async function getCustomSkillsByAgentIds(agentIds: string[]): Promise<Record<string, string[]>> {
  if (agentIds.length === 0) return {};
  const rows = await sql`SELECT agent_id, skill FROM agent_custom_skills WHERE agent_id = ANY(${agentIds}) ORDER BY created_at`;
  const result: Record<string, string[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    const r = row as { agent_id: string; skill: string };
    result[r.agent_id]?.push(r.skill);
  }
  return result;
}

export async function getTasksByAgentIds(agentIds: string[]): Promise<Record<string, Task[]>> {
  if (agentIds.length === 0) return {};
  const rows = await sql`SELECT * FROM tasks WHERE agent_id = ANY(${agentIds}) ORDER BY created_at DESC`;
  const result: Record<string, Task[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    const r = row as Task & { agent_id: string };
    result[r.agent_id]?.push(r);
  }
  return result;
}

export async function getActionsByAgentIds(agentIds: string[], limit = 10): Promise<Record<string, AgentAction[]>> {
  if (agentIds.length === 0) return {};
  const rows = await sql`SELECT * FROM agent_actions WHERE agent_id = ANY(${agentIds}) ORDER BY created_at DESC`;
  const result: Record<string, AgentAction[]> = {};
  for (const id of agentIds) result[id] = [];
  for (const row of rows) {
    const r = row as AgentAction;
    if (result[r.agent_id] && result[r.agent_id].length < limit) {
      result[r.agent_id].push(r);
    }
  }
  return result;
}

export async function getConversationCountsByAgentIds(agentIds: string[]): Promise<Record<string, { conversations: number; messages: number }>> {
  if (agentIds.length === 0) return {};
  const convRows = await sql`SELECT agent_id, COUNT(*) as cnt FROM conversations WHERE agent_id = ANY(${agentIds}) GROUP BY agent_id`;
  const msgRows = await sql`SELECT c.agent_id, COUNT(m.id) as cnt FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.agent_id = ANY(${agentIds}) GROUP BY c.agent_id`;

  const result: Record<string, { conversations: number; messages: number }> = {};
  for (const id of agentIds) result[id] = { conversations: 0, messages: 0 };
  for (const row of convRows) {
    const r = row as { agent_id: string; cnt: number };
    result[r.agent_id] = { ...result[r.agent_id], conversations: Number(r.cnt) };
  }
  for (const row of msgRows) {
    const r = row as { agent_id: string; cnt: number };
    result[r.agent_id] = { ...result[r.agent_id], messages: Number(r.cnt) };
  }
  return result;
}

// ─── Agent Evals ─────────────────────────────────────────
export interface AgentEval {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  message_id: string | null;
  eval_type: string;
  scores: string;
  judge_reasoning: string | null;
  user_feedback: string | null;
  prompt_used: string | null;
  response_evaluated: string | null;
  created_at: string;
}

export interface EvalTestSuite {
  id: string;
  role: string;
  test_name: string;
  test_prompt: string;
  expected_qualities: string | null;
  created_at: string;
}

export interface EvalRun {
  id: string;
  company_id: string;
  run_type: string;
  started_at: string;
  completed_at: string | null;
  results: string | null;
  status: string;
}

export async function createEval(data: {
  agent_id: string;
  conversation_id?: string;
  message_id?: string;
  eval_type: string;
  scores: string;
  judge_reasoning?: string;
  user_feedback?: string;
  prompt_used?: string;
  response_evaluated?: string;
}): Promise<AgentEval> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO agent_evals (id, agent_id, conversation_id, message_id, eval_type, scores, judge_reasoning, user_feedback, prompt_used, response_evaluated)
    VALUES (${id}, ${data.agent_id}, ${data.conversation_id || null}, ${data.message_id || null}, ${data.eval_type}, ${data.scores}, ${data.judge_reasoning || null}, ${data.user_feedback || null}, ${data.prompt_used || null}, ${data.response_evaluated || null})
    RETURNING *`;
  return row as AgentEval;
}

export async function getEvalsByAgent(agentId: string, limit = 50): Promise<AgentEval[]> {
  const rows = await sql`SELECT * FROM agent_evals WHERE agent_id = ${agentId} ORDER BY created_at DESC LIMIT ${limit}`;
  return rows as unknown as AgentEval[];
}

export async function getEvalsByCompany(companyId: string, limit = 100): Promise<AgentEval[]> {
  const rows = await sql`
    SELECT e.* FROM agent_evals e
    JOIN agents a ON e.agent_id = a.id
    WHERE a.company_id = ${companyId}
    ORDER BY e.created_at DESC LIMIT ${limit}`;
  return rows as unknown as AgentEval[];
}

export async function getAverageScores(agentId: string, days = 7): Promise<{ relevance: number; completeness: number; actionability: number; role_specificity: number; overall: number; count: number }> {
  const rows = await sql`
    SELECT scores_json as scores FROM agent_evals
    WHERE agent_id = ${agentId} AND created_at >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY created_at DESC`;

  if (rows.length === 0) return { relevance: 0, completeness: 0, actionability: 0, role_specificity: 0, overall: 0, count: 0 };

  let relevance = 0, completeness = 0, actionability = 0, role_specificity = 0, overall = 0;
  for (const row of rows) {
    try {
      const s = JSON.parse((row as { scores: string }).scores);
      relevance += s.relevance || 0;
      completeness += s.completeness || 0;
      actionability += s.actionability || 0;
      role_specificity += s.role_specificity || 0;
      overall += s.overall || 0;
    } catch { /* skip malformed */ }
  }
  const n = rows.length;
  return {
    relevance: Math.round((relevance / n) * 10) / 10,
    completeness: Math.round((completeness / n) * 10) / 10,
    actionability: Math.round((actionability / n) * 10) / 10,
    role_specificity: Math.round((role_specificity / n) * 10) / 10,
    overall: Math.round((overall / n) * 10) / 10,
    count: n,
  };
}

export async function updateUserFeedback(evalId: string, feedback: string): Promise<void> {
  await sql`UPDATE agent_evals SET user_feedback = ${feedback} WHERE id = ${evalId}`;
}

export async function getEvalTestSuites(role?: string): Promise<EvalTestSuite[]> {
  if (role) {
    const rows = await sql`SELECT * FROM eval_test_suites WHERE role = ${role} ORDER BY created_at ASC`;
    return rows as unknown as EvalTestSuite[];
  }
  const rows = await sql`SELECT * FROM eval_test_suites ORDER BY role, created_at ASC`;
  return rows as unknown as EvalTestSuite[];
}

export async function createEvalRun(companyId: string, runType: string): Promise<EvalRun> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO eval_runs (id, company_id, run_type) VALUES (${id}, ${companyId}, ${runType})
    RETURNING *`;
  return row as EvalRun;
}

export async function updateEvalRun(runId: string, data: { completed_at?: string; results?: string; status?: string }): Promise<void> {
  if (data.completed_at !== undefined) await sql`UPDATE eval_runs SET completed_at = ${data.completed_at} WHERE id = ${runId}`;
  if (data.results !== undefined) await sql`UPDATE eval_runs SET results = ${data.results} WHERE id = ${runId}`;
  if (data.status !== undefined) await sql`UPDATE eval_runs SET status = ${data.status} WHERE id = ${runId}`;
}

export async function getEvalRuns(companyId: string, limit = 20): Promise<EvalRun[]> {
  const rows = await sql`SELECT * FROM eval_runs WHERE company_id = ${companyId} ORDER BY started_at DESC LIMIT ${limit}`;
  return rows as unknown as EvalRun[];
}

export async function getUserFeedbackSummary(companyId: string): Promise<{ thumbs_up: number; thumbs_down: number; total: number }> {
  const [row] = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN e.user_feedback = 'thumbs_up' THEN 1 ELSE 0 END), 0) as thumbs_up,
      COALESCE(SUM(CASE WHEN e.user_feedback = 'thumbs_down' THEN 1 ELSE 0 END), 0) as thumbs_down,
      COUNT(*) as total
    FROM agent_evals e
    JOIN agents a ON e.agent_id = a.id
    WHERE a.company_id = ${companyId}`;
  const r = row as { thumbs_up: number; thumbs_down: number; total: number };
  return { thumbs_up: Number(r.thumbs_up) || 0, thumbs_down: Number(r.thumbs_down) || 0, total: Number(r.total) || 0 };
}

export async function getFlaggedEvals(companyId: string, limit = 20): Promise<AgentEval[]> {
  const rows = await sql`
    SELECT e.* FROM agent_evals e
    JOIN agents a ON e.agent_id = a.id
    WHERE a.company_id = ${companyId}
      AND (e.scores::json->>'overall')::int < 3
    ORDER BY e.created_at DESC LIMIT ${limit}`;
  return rows as unknown as AgentEval[];
}

// ─── Workflows ────────────────────────────────────────────
export interface Workflow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  trigger_agent_role: string;
  trigger_event: string;
  steps_json: string;
  is_active: number;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  company_id: string;
  status: string;
  current_step: number;
  results_json: string | null;
  started_at: string;
  completed_at: string | null;
}

export async function createWorkflow(data: {
  company_id: string;
  name: string;
  description?: string;
  trigger_agent_role: string;
  trigger_event: string;
  steps_json: string;
}): Promise<Workflow> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO workflows (id, company_id, name, description, trigger_agent_role, trigger_event, steps_json)
    VALUES (${id}, ${data.company_id}, ${data.name}, ${data.description ?? null}, ${data.trigger_agent_role}, ${data.trigger_event}, ${data.steps_json})
    RETURNING *`;
  return row as Workflow;
}

export async function getWorkflowsByCompany(companyId: string): Promise<Workflow[]> {
  const rows = await sql`SELECT * FROM workflows WHERE company_id = ${companyId} ORDER BY created_at DESC`;
  return rows as unknown as Workflow[];
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  const [row] = await sql`SELECT * FROM workflows WHERE id = ${id}`;
  return row as Workflow | undefined;
}

export async function getActiveWorkflowsByTrigger(companyId: string, triggerAgentRole: string, triggerEvent: string): Promise<Workflow[]> {
  const rows = await sql`
    SELECT * FROM workflows
    WHERE company_id = ${companyId} AND trigger_agent_role = ${triggerAgentRole} AND trigger_event = ${triggerEvent} AND is_active = 1`;
  return rows as unknown as Workflow[];
}

export async function updateWorkflow(id: string, data: { name?: string; description?: string; steps_json?: string; is_active?: number }): Promise<void> {
  if (data.name !== undefined) await sql`UPDATE workflows SET name = ${data.name} WHERE id = ${id}`;
  if (data.description !== undefined) await sql`UPDATE workflows SET description = ${data.description} WHERE id = ${id}`;
  if (data.steps_json !== undefined) await sql`UPDATE workflows SET steps_json = ${data.steps_json} WHERE id = ${id}`;
  if (data.is_active !== undefined) await sql`UPDATE workflows SET is_active = ${data.is_active} WHERE id = ${id}`;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await sql`DELETE FROM workflows WHERE id = ${id}`;
}

export async function incrementWorkflowTrigger(id: string): Promise<void> {
  await sql`UPDATE workflows SET trigger_count = trigger_count + 1, last_triggered_at = NOW() WHERE id = ${id}`;
}

export async function createWorkflowRun(data: { workflow_id: string; company_id: string }): Promise<WorkflowRun> {
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO workflow_runs (id, workflow_id, company_id) VALUES (${id}, ${data.workflow_id}, ${data.company_id})
    RETURNING *`;
  return row as WorkflowRun;
}

export async function updateWorkflowRun(id: string, data: { status?: string; current_step?: number; results_json?: string; completed_at?: string }): Promise<void> {
  if (data.status !== undefined) await sql`UPDATE workflow_runs SET status = ${data.status} WHERE id = ${id}`;
  if (data.current_step !== undefined) await sql`UPDATE workflow_runs SET current_step = ${data.current_step} WHERE id = ${id}`;
  if (data.results_json !== undefined) await sql`UPDATE workflow_runs SET results_json = ${data.results_json} WHERE id = ${id}`;
  if (data.completed_at !== undefined) await sql`UPDATE workflow_runs SET completed_at = ${data.completed_at} WHERE id = ${id}`;
}

export async function getWorkflowRunsByCompany(companyId: string, limit = 20): Promise<WorkflowRun[]> {
  const rows = await sql`SELECT * FROM workflow_runs WHERE company_id = ${companyId} ORDER BY started_at DESC LIMIT ${limit}`;
  return rows as unknown as WorkflowRun[];
}

// ─── Conversation Search ──────────────────────────────────
export async function searchMessages(companyId: string, query: string, options?: { agentId?: string; limit?: number }): Promise<Array<{
  message_id: string;
  conversation_id: string;
  agent_id: string;
  agent_role: string;
  role: string;
  content: string;
  created_at: string;
}>> {
  const limit = options?.limit ?? 50;
  const escaped = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const searchTerm = `%${escaped}%`;

  if (options?.agentId) {
    const rows = await sql`
      SELECT m.id as message_id, m.conversation_id, c.agent_id, a.role as agent_role, m.role, m.content, m.created_at
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN agents a ON c.agent_id = a.id
      WHERE a.company_id = ${companyId} AND a.id = ${options.agentId} AND m.content ILIKE ${searchTerm}
      ORDER BY m.created_at DESC LIMIT ${limit}`;
    return rows as unknown as Array<{
      message_id: string; conversation_id: string; agent_id: string; agent_role: string;
      role: string; content: string; created_at: string;
    }>;
  }

  const rows = await sql`
    SELECT m.id as message_id, m.conversation_id, c.agent_id, a.role as agent_role, m.role, m.content, m.created_at
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    JOIN agents a ON c.agent_id = a.id
    WHERE a.company_id = ${companyId} AND m.content ILIKE ${searchTerm}
    ORDER BY m.created_at DESC LIMIT ${limit}`;
  return rows as unknown as Array<{
    message_id: string; conversation_id: string; agent_id: string; agent_role: string;
    role: string; content: string; created_at: string;
  }>;
}

// ─── Agent Leaderboard ────────────────────────────────────
export async function getAgentLeaderboard(companyId: string): Promise<Array<{
  agent_id: string;
  role: string;
  message_count: number;
  task_count: number;
  tasks_completed: number;
  avg_score: number;
  thumbs_up: number;
  thumbs_down: number;
}>> {
  const rows = await sql`
    SELECT
      a.id as agent_id,
      a.role,
      COALESCE(msg_counts.message_count, 0) as message_count,
      COALESCE(task_counts.task_count, 0) as task_count,
      COALESCE(task_counts.tasks_completed, 0) as tasks_completed,
      COALESCE(eval_scores.avg_score, 0) as avg_score,
      COALESCE(eval_scores.thumbs_up, 0) as thumbs_up,
      COALESCE(eval_scores.thumbs_down, 0) as thumbs_down
    FROM agents a
    LEFT JOIN (
      SELECT c.agent_id, COUNT(m.id) as message_count
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.role = 'assistant'
      GROUP BY c.agent_id
    ) msg_counts ON msg_counts.agent_id = a.id
    LEFT JOIN (
      SELECT agent_id,
             COUNT(*) as task_count,
             SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as tasks_completed
      FROM tasks
      GROUP BY agent_id
    ) task_counts ON task_counts.agent_id = a.id
    LEFT JOIN (
      SELECT agent_id,
             AVG(CASE WHEN scores_json IS NOT NULL AND scores_json != '' THEN (scores_json::json->>'overall')::float ELSE NULL END) as avg_score,
             SUM(CASE WHEN feedback = 'thumbs_up' THEN 1 ELSE 0 END) as thumbs_up,
             SUM(CASE WHEN feedback = 'thumbs_down' THEN 1 ELSE 0 END) as thumbs_down
      FROM agent_evals
      GROUP BY agent_id
    ) eval_scores ON eval_scores.agent_id = a.id
    WHERE a.company_id = ${companyId}
    ORDER BY avg_score DESC, message_count DESC`;
  return rows as unknown as Array<{
    agent_id: string; role: string; message_count: number; task_count: number;
    tasks_completed: number; avg_score: number; thumbs_up: number; thumbs_down: number;
  }>;
}
