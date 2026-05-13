/**
 * Knowledge graph — typed surface for the v3 entity tables introduced in
 * migrations 007 + 008.
 *
 * Strategy: additive. This module never touches the existing memory
 * sources (per-agent memory, lessons, vault, activity feed). It only
 * reads/writes the new structured rows + edges, and src/lib/memory.ts
 * folds these in when present.
 *
 * Every read returns [] when DATABASE_URL is not configured (dev mode),
 * so the codebase keeps working without applying migration 007/008.
 *
 * Tests in test/knowledge-graph.test.ts.
 */

import { randomUUID } from "crypto";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  role?: string;
  isExternal: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type ConversationKind =
  | "meeting"
  | "call"
  | "email_thread"
  | "chat"
  | "agent_run"
  | "note";

export interface Conversation {
  id: string;
  companyId: string;
  kind: ConversationKind;
  title?: string;
  occurredAt?: Date;
  source?: string;
  sourceRef?: string;
  transcript?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Decision {
  id: string;
  companyId: string;
  title: string;
  detail?: string;
  decidedBy?: string;
  decidedAt?: Date;
  category?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type CommitmentStatus = "open" | "resolved" | "overdue" | "cancelled";

export interface Commitment {
  id: string;
  companyId: string;
  description: string;
  committedBy?: string;
  committedTo?: string;
  dueAt?: Date;
  status: CommitmentStatus;
  resolvedAt?: Date;
  sourceConversationId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface EventLogEntry {
  id: string;
  companyId: string;
  title: string;
  startsAt: Date;
  endsAt?: Date;
  source?: string;
  sourceRef?: string;
  attendees: unknown[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type ArtifactKind =
  | "draft_email"
  | "prospect_list"
  | "brief"
  | "plan"
  | "report"
  | "contract"
  | "other";

export interface Artifact {
  id: string;
  companyId: string;
  agentId?: string;
  agentRole?: string;
  runId?: string;
  kind: ArtifactKind;
  title: string;
  body?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface KnowledgeEdge {
  id: string;
  companyId: string;
  sourceType: string;
  sourceId: string;
  relation: string;
  targetType: string;
  targetId: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

// ─── DB connection ─────────────────────────────────────────────────────────

async function getSql(): Promise<unknown | null> {
  const mod = await import("./db-postgres");
  return (mod as { sql?: unknown }).sql ?? null;
}

// ─── Row mappers ───────────────────────────────────────────────────────────

interface PersonRow {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  role: string | null;
  is_external: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function mapPerson(r: PersonRow): Person {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    email: r.email ?? undefined,
    role: r.role ?? undefined,
    isExternal: r.is_external,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

interface ConversationRow {
  id: string;
  company_id: string;
  kind: ConversationKind;
  title: string | null;
  occurred_at: Date | null;
  source: string | null;
  source_ref: string | null;
  transcript: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function mapConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    companyId: r.company_id,
    kind: r.kind,
    title: r.title ?? undefined,
    occurredAt: r.occurred_at ?? undefined,
    source: r.source ?? undefined,
    sourceRef: r.source_ref ?? undefined,
    transcript: r.transcript ?? undefined,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

interface DecisionRow {
  id: string;
  company_id: string;
  title: string;
  detail: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  category: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function mapDecision(r: DecisionRow): Decision {
  return {
    id: r.id,
    companyId: r.company_id,
    title: r.title,
    detail: r.detail ?? undefined,
    decidedBy: r.decided_by ?? undefined,
    decidedAt: r.decided_at ?? undefined,
    category: r.category ?? undefined,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

interface CommitmentRow {
  id: string;
  company_id: string;
  description: string;
  committed_by: string | null;
  committed_to: string | null;
  due_at: Date | null;
  status: CommitmentStatus;
  resolved_at: Date | null;
  source_conversation_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function mapCommitment(r: CommitmentRow): Commitment {
  return {
    id: r.id,
    companyId: r.company_id,
    description: r.description,
    committedBy: r.committed_by ?? undefined,
    committedTo: r.committed_to ?? undefined,
    dueAt: r.due_at ?? undefined,
    status: r.status,
    resolvedAt: r.resolved_at ?? undefined,
    sourceConversationId: r.source_conversation_id ?? undefined,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

interface EventRow {
  id: string;
  company_id: string;
  title: string;
  starts_at: Date;
  ends_at: Date | null;
  source: string | null;
  source_ref: string | null;
  attendees: unknown[] | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function mapEvent(r: EventRow): EventLogEntry {
  return {
    id: r.id,
    companyId: r.company_id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at ?? undefined,
    source: r.source ?? undefined,
    sourceRef: r.source_ref ?? undefined,
    attendees: r.attendees ?? [],
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

interface ArtifactRow {
  id: string;
  company_id: string;
  agent_id: string | null;
  agent_role: string | null;
  run_id: string | null;
  kind: ArtifactKind;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function mapArtifact(r: ArtifactRow): Artifact {
  return {
    id: r.id,
    companyId: r.company_id,
    agentId: r.agent_id ?? undefined,
    agentRole: r.agent_role ?? undefined,
    runId: r.run_id ?? undefined,
    kind: r.kind,
    title: r.title,
    body: r.body ?? undefined,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

interface EdgeRow {
  id: string;
  company_id: string;
  source_type: string;
  source_id: string;
  relation: string;
  target_type: string;
  target_id: string;
  properties: Record<string, unknown> | null;
  created_at: Date;
}

function mapEdge(r: EdgeRow): KnowledgeEdge {
  return {
    id: r.id,
    companyId: r.company_id,
    sourceType: r.source_type,
    sourceId: r.source_id,
    relation: r.relation,
    targetType: r.target_type,
    targetId: r.target_id,
    properties: r.properties ?? {},
    createdAt: r.created_at,
  };
}

// ─── Inserts ───────────────────────────────────────────────────────────────

type SqlTemplate = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>;

export async function createPerson(input: {
  companyId: string;
  name: string;
  email?: string;
  role?: string;
  isExternal?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<Person | null> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return null;
  const id = `person_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO persons (id, company_id, name, email, role, is_external, metadata)
    VALUES (
      ${id}, ${input.companyId}, ${input.name},
      ${input.email ?? null}, ${input.role ?? null},
      ${input.isExternal ?? true},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id, company_id, name, email, role, is_external, metadata, created_at
  `) as PersonRow[];
  return rows[0] ? mapPerson(rows[0]) : null;
}

export async function createConversation(input: {
  companyId: string;
  kind: ConversationKind;
  title?: string;
  occurredAt?: Date;
  source?: string;
  sourceRef?: string;
  transcript?: string;
  metadata?: Record<string, unknown>;
}): Promise<Conversation | null> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return null;
  const id = `conv_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO conversations
      (id, company_id, kind, title, occurred_at, source, source_ref, transcript, metadata)
    VALUES (
      ${id}, ${input.companyId}, ${input.kind},
      ${input.title ?? null}, ${input.occurredAt ?? null},
      ${input.source ?? null}, ${input.sourceRef ?? null},
      ${input.transcript ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id, company_id, kind, title, occurred_at, source, source_ref,
              transcript, metadata, created_at
  `) as ConversationRow[];
  return rows[0] ? mapConversation(rows[0]) : null;
}

export async function createDecision(input: {
  companyId: string;
  title: string;
  detail?: string;
  decidedBy?: string;
  decidedAt?: Date;
  category?: string;
  metadata?: Record<string, unknown>;
}): Promise<Decision | null> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return null;
  const id = `dec_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO decisions
      (id, company_id, title, detail, decided_by, decided_at, category, metadata)
    VALUES (
      ${id}, ${input.companyId}, ${input.title},
      ${input.detail ?? null}, ${input.decidedBy ?? null},
      ${input.decidedAt ?? null}, ${input.category ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id, company_id, title, detail, decided_by, decided_at, category, metadata, created_at
  `) as DecisionRow[];
  return rows[0] ? mapDecision(rows[0]) : null;
}

export async function createCommitment(input: {
  companyId: string;
  description: string;
  committedBy?: string;
  committedTo?: string;
  dueAt?: Date;
  sourceConversationId?: string;
  metadata?: Record<string, unknown>;
}): Promise<Commitment | null> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return null;
  const id = `commit_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO commitments
      (id, company_id, description, committed_by, committed_to, due_at,
       source_conversation_id, metadata)
    VALUES (
      ${id}, ${input.companyId}, ${input.description},
      ${input.committedBy ?? null}, ${input.committedTo ?? null},
      ${input.dueAt ?? null}, ${input.sourceConversationId ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id, company_id, description, committed_by, committed_to, due_at,
              status, resolved_at, source_conversation_id, metadata, created_at
  `) as CommitmentRow[];
  return rows[0] ? mapCommitment(rows[0]) : null;
}

export async function createEventLog(input: {
  companyId: string;
  title: string;
  startsAt: Date;
  endsAt?: Date;
  source?: string;
  sourceRef?: string;
  attendees?: unknown[];
  metadata?: Record<string, unknown>;
}): Promise<EventLogEntry | null> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return null;
  const id = `event_${randomUUID()}`;
  // Idempotency: if a (company_id, source, source_ref) tuple already exists,
  // update it in place rather than inserting a duplicate. This lets calendar
  // sync push the same event multiple times safely.
  if (input.source && input.sourceRef) {
    const existing = (await sql`
      SELECT id FROM events_log
      WHERE company_id = ${input.companyId}
        AND source = ${input.source}
        AND source_ref = ${input.sourceRef}
      LIMIT 1
    `) as Array<{ id: string }>;
    if (existing[0]) {
      const rows = (await sql`
        UPDATE events_log SET
          title = ${input.title},
          starts_at = ${input.startsAt},
          ends_at = ${input.endsAt ?? null},
          attendees = ${JSON.stringify(input.attendees ?? [])}::jsonb,
          metadata = ${JSON.stringify(input.metadata ?? {})}::jsonb
        WHERE id = ${existing[0].id}
        RETURNING id, company_id, title, starts_at, ends_at, source, source_ref,
                  attendees, metadata, created_at
      `) as EventRow[];
      return rows[0] ? mapEvent(rows[0]) : null;
    }
  }
  const rows = (await sql`
    INSERT INTO events_log
      (id, company_id, title, starts_at, ends_at, source, source_ref, attendees, metadata)
    VALUES (
      ${id}, ${input.companyId}, ${input.title},
      ${input.startsAt}, ${input.endsAt ?? null},
      ${input.source ?? null}, ${input.sourceRef ?? null},
      ${JSON.stringify(input.attendees ?? [])}::jsonb,
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id, company_id, title, starts_at, ends_at, source, source_ref,
              attendees, metadata, created_at
  `) as EventRow[];
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function getEventsBetween(
  companyId: string,
  from: Date,
  to: Date
): Promise<EventLogEntry[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, title, starts_at, ends_at, source, source_ref,
           attendees, metadata, created_at
    FROM events_log
    WHERE company_id = ${companyId}
      AND starts_at >= ${from}
      AND starts_at < ${to}
    ORDER BY starts_at ASC
  `) as EventRow[];
  return rows.map(mapEvent);
}

/**
 * Cross-tenant scan for events starting within a window. The cron worker
 * uses this to find every upcoming meeting across all tenants and queue
 * pre-meeting briefs ahead of them.
 *
 * Bypasses RLS by design — only called from server-side cron with the
 * internal secret. Returns event rows with `companyId` so the caller can
 * fan out per-tenant.
 */
/**
 * Merge a partial metadata object into an event's existing metadata. Used
 * by the brief cron to stamp `brief_sent_at` so subsequent runs skip the
 * event.
 */
export async function updateEventMetadata(
  eventId: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return false;
  const rows = (await sql`
    UPDATE events_log
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
    WHERE id = ${eventId}
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

export async function getEventsAcrossTenantsBetween(
  from: Date,
  to: Date,
  limit = 500
): Promise<EventLogEntry[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, title, starts_at, ends_at, source, source_ref,
           attendees, metadata, created_at
    FROM events_log
    WHERE starts_at >= ${from}
      AND starts_at < ${to}
    ORDER BY starts_at ASC
    LIMIT ${limit}
  `) as EventRow[];
  return rows.map(mapEvent);
}

export async function createArtifact(input: {
  companyId: string;
  kind: ArtifactKind;
  title: string;
  body?: string;
  agentId?: string;
  agentRole?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<Artifact | null> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return null;
  const id = `art_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO artifacts
      (id, company_id, agent_id, agent_role, run_id, kind, title, body, metadata)
    VALUES (
      ${id}, ${input.companyId}, ${input.agentId ?? null}, ${input.agentRole ?? null},
      ${input.runId ?? null}, ${input.kind}, ${input.title},
      ${input.body ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id, company_id, agent_id, agent_role, run_id, kind, title, body, metadata, created_at
  `) as ArtifactRow[];
  return rows[0] ? mapArtifact(rows[0]) : null;
}

export async function createEdge(input: {
  companyId: string;
  sourceType: string;
  sourceId: string;
  relation: string;
  targetType: string;
  targetId: string;
  properties?: Record<string, unknown>;
}): Promise<KnowledgeEdge | null> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return null;
  const id = `edge_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO knowledge_edges
      (id, company_id, source_type, source_id, relation, target_type, target_id, properties)
    VALUES (
      ${id}, ${input.companyId}, ${input.sourceType}, ${input.sourceId},
      ${input.relation}, ${input.targetType}, ${input.targetId},
      ${JSON.stringify(input.properties ?? {})}::jsonb
    )
    RETURNING id, company_id, source_type, source_id, relation,
              target_type, target_id, properties, created_at
  `) as EdgeRow[];
  return rows[0] ? mapEdge(rows[0]) : null;
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function getRecentConversations(
  companyId: string,
  limit = 20
): Promise<Conversation[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, kind, title, occurred_at, source, source_ref,
           transcript, metadata, created_at
    FROM conversations
    WHERE company_id = ${companyId}
    ORDER BY occurred_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  `) as ConversationRow[];
  return rows.map(mapConversation);
}

export async function getRecentDecisions(
  companyId: string,
  limit = 20
): Promise<Decision[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, title, detail, decided_by, decided_at, category, metadata, created_at
    FROM decisions
    WHERE company_id = ${companyId}
    ORDER BY decided_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  `) as DecisionRow[];
  return rows.map(mapDecision);
}

export async function getOpenCommitments(
  companyId: string,
  limit = 50
): Promise<Commitment[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, description, committed_by, committed_to, due_at,
           status, resolved_at, source_conversation_id, metadata, created_at
    FROM commitments
    WHERE company_id = ${companyId} AND status = 'open'
    ORDER BY due_at ASC NULLS LAST
    LIMIT ${limit}
  `) as CommitmentRow[];
  return rows.map(mapCommitment);
}

export async function getUpcomingEvents(
  companyId: string,
  limit = 20
): Promise<EventLogEntry[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, title, starts_at, ends_at, source, source_ref,
           attendees, metadata, created_at
    FROM events_log
    WHERE company_id = ${companyId} AND starts_at >= NOW()
    ORDER BY starts_at ASC
    LIMIT ${limit}
  `) as EventRow[];
  return rows.map(mapEvent);
}

export async function getRecentArtifacts(
  companyId: string,
  limit = 20
): Promise<Artifact[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, agent_id, agent_role, run_id, kind, title, body, metadata, created_at
    FROM artifacts
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as ArtifactRow[];
  return rows.map(mapArtifact);
}

export async function getEdgesFrom(
  companyId: string,
  sourceType: string,
  sourceId: string
): Promise<KnowledgeEdge[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, source_type, source_id, relation,
           target_type, target_id, properties, created_at
    FROM knowledge_edges
    WHERE company_id = ${companyId}
      AND source_type = ${sourceType}
      AND source_id = ${sourceId}
    ORDER BY created_at DESC
  `) as EdgeRow[];
  return rows.map(mapEdge);
}

export async function getEdgesTo(
  companyId: string,
  targetType: string,
  targetId: string
): Promise<KnowledgeEdge[]> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, source_type, source_id, relation,
           target_type, target_id, properties, created_at
    FROM knowledge_edges
    WHERE company_id = ${companyId}
      AND target_type = ${targetType}
      AND target_id = ${targetId}
    ORDER BY created_at DESC
  `) as EdgeRow[];
  return rows.map(mapEdge);
}

// ─── Summary counts (for /admin/memory header expansion) ───────────────────

export interface GraphSummary {
  persons: number;
  conversations: number;
  decisions: number;
  openCommitments: number;
  upcomingEvents: number;
  artifacts: number;
  edges: number;
}

export async function summarizeKnowledgeGraph(
  companyId: string
): Promise<GraphSummary> {
  const sql = (await getSql()) as SqlTemplate | null;
  if (!sql) {
    return {
      persons: 0,
      conversations: 0,
      decisions: 0,
      openCommitments: 0,
      upcomingEvents: 0,
      artifacts: 0,
      edges: 0,
    };
  }
  const oneShot = async (table: string, where: string): Promise<number> => {
    try {
      const rows = (await sql`
        SELECT count(*)::int AS n FROM ${sqlIdent(table)} WHERE ${sqlRaw(where)}
      `) as Array<{ n: number }>;
      return rows[0]?.n ?? 0;
    } catch {
      return 0;
    }
  };

  // postgres.js typing for raw SQL identifiers requires a tagged-template
  // shim; we fall back to per-call raw queries to keep this simple.
  const counts = await Promise.all([
    countWhere(sql, "persons", companyId),
    countWhere(sql, "conversations", companyId),
    countWhere(sql, "decisions", companyId),
    countOpenCommitments(sql, companyId),
    countUpcomingEvents(sql, companyId),
    countWhere(sql, "artifacts", companyId),
    countWhere(sql, "knowledge_edges", companyId),
  ]);

  // Silence the unused-symbol warning for the oneShot helper kept above as
  // documentation for the inline counting pattern.
  void oneShot;

  return {
    persons: counts[0],
    conversations: counts[1],
    decisions: counts[2],
    openCommitments: counts[3],
    upcomingEvents: counts[4],
    artifacts: counts[5],
    edges: counts[6],
  };
}

async function countWhere(
  sql: SqlTemplate,
  table: "persons" | "conversations" | "decisions" | "artifacts" | "knowledge_edges",
  companyId: string
): Promise<number> {
  try {
    let rows: Array<{ n: number }> = [];
    if (table === "persons") {
      rows = (await sql`SELECT count(*)::int AS n FROM persons WHERE company_id = ${companyId}`) as Array<{ n: number }>;
    } else if (table === "conversations") {
      rows = (await sql`SELECT count(*)::int AS n FROM conversations WHERE company_id = ${companyId}`) as Array<{ n: number }>;
    } else if (table === "decisions") {
      rows = (await sql`SELECT count(*)::int AS n FROM decisions WHERE company_id = ${companyId}`) as Array<{ n: number }>;
    } else if (table === "artifacts") {
      rows = (await sql`SELECT count(*)::int AS n FROM artifacts WHERE company_id = ${companyId}`) as Array<{ n: number }>;
    } else {
      rows = (await sql`SELECT count(*)::int AS n FROM knowledge_edges WHERE company_id = ${companyId}`) as Array<{ n: number }>;
    }
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

async function countOpenCommitments(
  sql: SqlTemplate,
  companyId: string
): Promise<number> {
  try {
    const rows = (await sql`
      SELECT count(*)::int AS n FROM commitments
      WHERE company_id = ${companyId} AND status = 'open'
    `) as Array<{ n: number }>;
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

async function countUpcomingEvents(
  sql: SqlTemplate,
  companyId: string
): Promise<number> {
  try {
    const rows = (await sql`
      SELECT count(*)::int AS n FROM events_log
      WHERE company_id = ${companyId} AND starts_at >= NOW()
    `) as Array<{ n: number }>;
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

// Unused helpers retained for type completeness — left as no-ops so we don't
// need them at module init.
function sqlIdent(name: string): string {
  return name;
}
function sqlRaw(s: string): string {
  return s;
}
