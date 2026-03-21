/**
 * Postgres database layer (drop-in replacement for db.ts)
 *
 * To activate:
 * 1. Set DATABASE_URL in .env.local to your Supabase/Postgres connection string
 * 2. Replace the import in every file that uses db.ts:
 *    - Find: from "@/lib/db"
 *    - Replace: from "@/lib/db-postgres"
 *    OR rename this file to db.ts and delete the old one
 *
 * The schema and function signatures are identical to the SQLite version.
 */

import postgres from "postgres";
import { randomUUID } from "crypto";
import type {
  Company,
  Agent,
  Conversation,
  Message,
  MemoryEntry,
  Analysis,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
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

  // Create indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_company ON agents(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory(agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id)`;
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
  return await sql`SELECT * FROM companies WHERE user_id = ${userId} ORDER BY created_at DESC` as Company[];
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
  return await sql`SELECT * FROM agents WHERE company_id = ${companyId} ORDER BY created_at` as Agent[];
}

export async function getAgentRoster(companyId: string): Promise<{ role: string; id: string }[]> {
  return await sql`SELECT id, role FROM agents WHERE company_id = ${companyId} AND status = 'active'` as { role: string; id: string }[];
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
  return await sql`SELECT * FROM conversations WHERE agent_id = ${agentId} ORDER BY updated_at DESC` as Conversation[];
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
  return await sql`
    SELECT * FROM messages WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC LIMIT ${limit}` as Message[];
}

// ─── Memory ──────────────────────────────────────────────
export async function getMemory(agentId: string): Promise<MemoryEntry[]> {
  return await sql`
    SELECT * FROM memory WHERE agent_id = ${agentId}
    ORDER BY updated_at DESC LIMIT 20` as MemoryEntry[];
}

export async function setMemory(agentId: string, key: string, value: string): Promise<void> {
  const id = randomUUID();
  await sql`
    INSERT INTO memory (id, agent_id, key, value)
    VALUES (${id}, ${agentId}, ${key}, ${value})
    ON CONFLICT (agent_id, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
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
  return await sql`SELECT * FROM tasks WHERE agent_id = ${agentId} ORDER BY created_at DESC` as Task[];
}

export async function getTasksByCompany(companyId: string): Promise<Task[]> {
  return await sql`
    SELECT t.* FROM tasks t
    JOIN agents a ON t.agent_id = a.id
    WHERE a.company_id = ${companyId}
    ORDER BY t.created_at DESC` as Task[];
}

export async function getNextQueuedTask(): Promise<Task | undefined> {
  // Use FOR UPDATE SKIP LOCKED to prevent double-processing
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

// ─── Subscriptions ───────────────────────────────────────
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
  await sql`
    INSERT INTO usage_records (id, company_id, month, ${sql(field)})
    VALUES (${id}, ${companyId}, ${month}, 1)
    ON CONFLICT (company_id, month)
    DO UPDATE SET ${sql(field)} = usage_records.${sql(field)} + 1`;
}

export async function checkPlanLimits(companyId: string) {
  const PLAN_LIMITS: Record<string, { agents: number; tasks: number }> = {
    free: { agents: 1, tasks: 100 },
    growth: { agents: 5, tasks: -1 },
    enterprise: { agents: -1, tasks: -1 },
  };

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
  return await sql`SELECT * FROM api_keys WHERE company_id = ${companyId} ORDER BY created_at DESC` as ApiKey[];
}

export async function deleteApiKey(id: string): Promise<void> {
  await sql`DELETE FROM api_keys WHERE id = ${id}`;
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
  return await sql`
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
    ) combined ORDER BY created_at DESC LIMIT ${limit}` as ActivityItem[];
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

// ─── Messaging Users ─────────────────────────────────────
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
  data: Partial<Omit<UserProfile, "id" | "user_id" | "created_at" | "updated_at">>
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
