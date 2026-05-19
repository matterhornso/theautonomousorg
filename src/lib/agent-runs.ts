/**
 * Agent runs — write + read helpers over the `agent_runs` table from
 * migration 008. Postgres-only; no DATABASE_URL returns null/[]. Tests rely
 * on this graceful fallback (the sqlite path has no agent_runs table).
 *
 * Langfuse remains the canonical detailed-trace store. This module is the
 * thin local index that powers /admin/agents/[role] and [role]/[runId]
 * without round-tripping Langfuse on every page load.
 *
 * Tests in test/agent-runs.test.ts.
 */

import { randomUUID } from "crypto";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_approval";

export type AgentRunTrigger = "user" | "cron" | "event" | "mention" | "api";

export interface AgentRun {
  id: string;
  companyId: string;
  agentRole: string;
  agentId?: string;
  triggeredBy: AgentRunTrigger;
  triggerDetail?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: AgentRunStatus;
  modelUsed?: string;
  provider?: string;
  tokensIn?: number;
  tokensOut?: number;
  creditsUsed?: number;
  langfuseTraceId?: string;
  summary?: string;
  errorDetail?: string;
  startedAt: Date;
  completedAt?: Date;
}

interface AgentRunRow {
  id: string;
  company_id: string;
  agent_role: string;
  agent_id: string | null;
  triggered_by: AgentRunTrigger;
  trigger_detail: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: AgentRunStatus;
  model_used: string | null;
  provider: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  credits_used: number | null;
  langfuse_trace_id: string | null;
  summary: string | null;
  error_detail: string | null;
  started_at: Date;
  completed_at: Date | null;
}

function mapRun(r: AgentRunRow): AgentRun {
  return {
    id: r.id,
    companyId: r.company_id,
    agentRole: r.agent_role,
    agentId: r.agent_id ?? undefined,
    triggeredBy: r.triggered_by,
    triggerDetail: r.trigger_detail ?? undefined,
    input: r.input,
    output: r.output ?? undefined,
    status: r.status,
    modelUsed: r.model_used ?? undefined,
    provider: r.provider ?? undefined,
    tokensIn: r.tokens_in ?? undefined,
    tokensOut: r.tokens_out ?? undefined,
    creditsUsed: r.credits_used ?? undefined,
    langfuseTraceId: r.langfuse_trace_id ?? undefined,
    summary: r.summary ?? undefined,
    errorDetail: r.error_detail ?? undefined,
    startedAt: r.started_at,
    completedAt: r.completed_at ?? undefined,
  };
}

type SqlTemplate = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>;

async function getSql(): Promise<SqlTemplate | null> {
  const mod = await import("./db-postgres");
  return ((mod as { sql?: unknown }).sql as SqlTemplate | undefined) ?? null;
}

// ─── Writes ────────────────────────────────────────────────────────────────

export async function createAgentRun(input: {
  /** Optional pre-allocated id. Callers that mint their own runId (e.g.
   * AgentRunner, which embeds runId in the trace) pass it here so the DB
   * row and the trace stay in lockstep. If omitted, a fresh `run_<uuid>`
   * is generated. */
  id?: string;
  companyId: string;
  agentRole: string;
  agentId?: string;
  triggeredBy: AgentRunTrigger;
  triggerDetail?: string;
  input: Record<string, unknown>;
  status?: AgentRunStatus;
}): Promise<AgentRun | null> {
  const sql = await getSql();
  if (!sql) return null;
  const id = input.id ?? `run_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO agent_runs
      (id, company_id, agent_role, agent_id, triggered_by, trigger_detail, input, status)
    VALUES (
      ${id}, ${input.companyId}, ${input.agentRole},
      ${input.agentId ?? null}, ${input.triggeredBy},
      ${input.triggerDetail ?? null},
      ${JSON.stringify(input.input)}::jsonb,
      ${input.status ?? "running"}
    )
    RETURNING *
  `) as AgentRunRow[];
  return rows[0] ? mapRun(rows[0]) : null;
}

export async function completeAgentRun(
  id: string,
  data: {
    status: AgentRunStatus;
    output?: Record<string, unknown>;
    modelUsed?: string;
    provider?: string;
    tokensIn?: number;
    tokensOut?: number;
    creditsUsed?: number;
    langfuseTraceId?: string;
    summary?: string;
    errorDetail?: string;
  }
): Promise<AgentRun | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    UPDATE agent_runs SET
      status = ${data.status},
      output = ${data.output ? JSON.stringify(data.output) : null}::jsonb,
      model_used = ${data.modelUsed ?? null},
      provider = ${data.provider ?? null},
      tokens_in = ${data.tokensIn ?? null},
      tokens_out = ${data.tokensOut ?? null},
      credits_used = ${data.creditsUsed ?? null},
      langfuse_trace_id = ${data.langfuseTraceId ?? null},
      summary = ${data.summary ?? null},
      error_detail = ${data.errorDetail ?? null},
      completed_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as AgentRunRow[];
  return rows[0] ? mapRun(rows[0]) : null;
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function getAgentRun(id: string): Promise<AgentRun | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM agent_runs WHERE id = ${id} LIMIT 1
  `) as AgentRunRow[];
  return rows[0] ? mapRun(rows[0]) : null;
}

export async function getAgentRunsByRole(
  companyId: string,
  agentRole: string,
  limit = 20
): Promise<AgentRun[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT * FROM agent_runs
    WHERE company_id = ${companyId} AND agent_role = ${agentRole}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `) as AgentRunRow[];
  return rows.map(mapRun);
}

export async function getRecentAgentRuns(
  companyId: string,
  limit = 20
): Promise<AgentRun[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT * FROM agent_runs
    WHERE company_id = ${companyId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `) as AgentRunRow[];
  return rows.map(mapRun);
}

export async function getOpenAgentRuns(
  companyId: string
): Promise<AgentRun[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT * FROM agent_runs
    WHERE company_id = ${companyId}
      AND status IN ('queued', 'running', 'awaiting_approval')
    ORDER BY started_at DESC
  `) as AgentRunRow[];
  return rows.map(mapRun);
}

// ─── Helper: lesson + run together ─────────────────────────────────────────
//
// The "closed loop" promise needs both halves wired. createAgentRun is one
// side; writeLessonFromRun is the other. Pulled here (not in lessons.ts) so
// the chat handlers have one import surface for "record this run".

export interface RunSummary {
  /** Short human-friendly description of what the agent did. */
  taskDescription: string;
  /** Did a human accept/reject/modify the output? unknown = no signal yet. */
  outputAccepted?: "approved" | "rejected" | "modified" | "unknown";
  /** If modified, what changed. */
  modificationDetail?: string;
  /** Agent's own afterRun reflection (or what the chat path inferred). */
  selfCritique?: string;
}
