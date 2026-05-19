/**
 * Company memory facade — unified query over the four sources of truth that
 * already exist in this codebase:
 *
 *   1. Per-agent key-value memory     (db.getMemoryByAgentIds)
 *   2. Per-agent lessons              (lessons table via LessonsHelper)
 *   3. Vault documents + chunks       (pgvector semantic search via VaultHelper)
 *   4. Recent activity feed           (db.getActivityFeed — tasks + relays)
 *
 * The v2 "shared brain" promise is that every agent in a tenant reads from
 * the same memory. This module is the read side of that promise. No new
 * schema needed — we just fan out across what's already persisted and
 * normalize the results into a single MemoryHit shape that the admin UI
 * and AgentRunner.beforeRun can consume.
 *
 * Tests in test/memory.test.ts.
 */

import {
  getAgentsByCompany,
  getMemoryByAgentIds,
  getActivityFeed,
} from "./db";
import { buildLessonsHelper } from "./lessons";
import { buildVaultHelper } from "./vault";
import {
  getRecentConversations,
  getRecentDecisions,
  getOpenCommitments,
  getRecentArtifacts,
  summarizeKnowledgeGraph,
} from "./knowledge-graph";

export type MemoryHitType = "memory" | "lesson" | "vault" | "activity" | "graph";

/** Entity kind within the knowledge graph when type === "graph". */
export type GraphEntityKind =
  | "conversation"
  | "decision"
  | "commitment"
  | "artifact";

export interface MemoryHit {
  type: MemoryHitType;
  /** Short label suitable for a list row title. */
  title: string;
  /** Body / supporting text. */
  body: string;
  /** ISO timestamp of when this artifact was produced. */
  createdAt: string;
  /** Where the hit came from — agent role, doc id, vault chunk, graph entity. */
  source: {
    agentId?: string;
    agentRole?: string;
    docId?: string;
    docTitle?: string;
    chunkId?: string;
    runId?: string;
    entityKind?: GraphEntityKind;
    entityId?: string;
  };
  /** Optional relevance score in [0, 1] when a query was supplied. */
  score?: number;
}

export interface QueryCompanyMemoryOptions {
  companyId: string;
  /** Free-text query. When present, vault is searched semantically and other
   *  sources are post-filtered (substring match). */
  query?: string;
  /** Restrict to specific sources. Default: all four. */
  types?: MemoryHitType[];
  /** Per-source soft cap. Default 5. */
  perSourceLimit?: number;
  /** Overall result cap. Default 20. */
  limit?: number;
}

const DEFAULT_TYPES: MemoryHitType[] = [
  "memory",
  "lesson",
  "vault",
  "activity",
  "graph",
];

/**
 * Read across the four memory sources for a tenant and return a normalized,
 * merged list. Designed to be safe to call without a database — each source
 * is wrapped in try/catch and contributes whatever it can.
 */
export async function queryCompanyMemory(
  opts: QueryCompanyMemoryOptions
): Promise<MemoryHit[]> {
  const types = opts.types ?? DEFAULT_TYPES;
  const perSourceLimit = opts.perSourceLimit ?? 5;
  const limit = opts.limit ?? 20;
  const q = opts.query?.trim().toLowerCase();

  const hits: MemoryHit[] = [];

  // ─── 1. Per-agent key-value memory ───────────────────────────────────────
  if (types.includes("memory")) {
    try {
      const agents = await getAgentsByCompany(opts.companyId);
      const agentIds = agents.map((a) => a.id);
      if (agentIds.length > 0) {
        const byAgent = await getMemoryByAgentIds(agentIds);
        const roleById = new Map(agents.map((a) => [a.id, a.role] as const));
        for (const [agentId, entries] of Object.entries(byAgent)) {
          const role = roleById.get(agentId) ?? "Agent";
          for (const entry of entries.slice(0, perSourceLimit)) {
            if (q && !`${entry.key} ${entry.value}`.toLowerCase().includes(q))
              continue;
            hits.push({
              type: "memory",
              title: `${role}: ${entry.key}`,
              body: entry.value,
              createdAt: entry.created_at,
              source: { agentId, agentRole: role },
            });
          }
        }
      }
    } catch (err) {
      console.warn("[memory] agent-memory lookup failed:", err);
    }
  }

  // ─── 2. Per-agent lessons ────────────────────────────────────────────────
  if (types.includes("lesson")) {
    try {
      const agents = await getAgentsByCompany(opts.companyId);
      for (const agent of agents) {
        const lessons = await buildLessonsHelper({
          firmId: opts.companyId,
          agentId: agent.id,
        }).readRecent({ limit: perSourceLimit });
        for (const l of lessons) {
          const detail = [
            l.modificationDetail ? `Change: ${l.modificationDetail}` : null,
            l.selfCritique ? `Note: ${l.selfCritique}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          if (
            q &&
            !`${l.taskDescription} ${detail}`.toLowerCase().includes(q)
          )
            continue;
          hits.push({
            type: "lesson",
            title: `${agent.role}: ${l.taskDescription}`,
            body: detail || `Outcome: ${l.outputAccepted}`,
            createdAt:
              l.createdAt instanceof Date
                ? l.createdAt.toISOString()
                : String(l.createdAt),
            source: { agentId: agent.id, agentRole: agent.role, runId: l.runId },
          });
        }
      }
    } catch (err) {
      console.warn("[memory] lessons lookup failed:", err);
    }
  }

  // ─── 3. Vault semantic search ────────────────────────────────────────────
  if (types.includes("vault") && q && opts.query) {
    try {
      const chunks = await buildVaultHelper({ firmId: opts.companyId }).query({
        q: opts.query,
        limit: perSourceLimit,
      });
      for (const chunk of chunks) {
        hits.push({
          type: "vault",
          title: chunk.source.docTitle,
          body: chunk.text,
          // VaultChunk has no timestamp; use now as a stable fallback.
          createdAt: new Date(0).toISOString(),
          source: {
            docId: chunk.source.docId,
            docTitle: chunk.source.docTitle,
            chunkId: chunk.chunkId,
          },
          score: chunk.score,
        });
      }
    } catch (err) {
      console.warn("[memory] vault query failed:", err);
    }
  }

  // ─── 4. Knowledge graph entities (conversations, decisions, commitments, artifacts)
  // Surfaces v3 entity rows once tenants populate them. Returns empty when
  // migrations 007/008 aren't applied yet — zero behavior change for v2.
  if (types.includes("graph")) {
    try {
      const [conversations, decisions, commitments, artifacts] =
        await Promise.all([
          getRecentConversations(opts.companyId, perSourceLimit),
          getRecentDecisions(opts.companyId, perSourceLimit),
          getOpenCommitments(opts.companyId, perSourceLimit),
          getRecentArtifacts(opts.companyId, perSourceLimit),
        ]);
      for (const c of conversations) {
        const haystack = `${c.title ?? ""} ${c.transcript ?? ""}`.toLowerCase();
        if (q && !haystack.includes(q)) continue;
        hits.push({
          type: "graph",
          title: c.title ?? `${c.kind} conversation`,
          body: c.transcript ? c.transcript.slice(0, 240) : `${c.kind} · ${c.source ?? "unspecified source"}`,
          createdAt: (c.occurredAt ?? c.createdAt).toISOString(),
          source: { entityKind: "conversation", entityId: c.id },
        });
      }
      for (const d of decisions) {
        const haystack = `${d.title} ${d.detail ?? ""}`.toLowerCase();
        if (q && !haystack.includes(q)) continue;
        hits.push({
          type: "graph",
          title: d.title,
          body: d.detail ?? `Decision · ${d.category ?? "uncategorized"}${d.decidedBy ? " · " + d.decidedBy : ""}`,
          createdAt: (d.decidedAt ?? d.createdAt).toISOString(),
          source: { entityKind: "decision", entityId: d.id },
        });
      }
      for (const cm of commitments) {
        if (q && !cm.description.toLowerCase().includes(q)) continue;
        const dueLabel = cm.dueAt
          ? `Due ${cm.dueAt.toISOString().slice(0, 10)}`
          : "No due date";
        hits.push({
          type: "graph",
          title: cm.description,
          body: `Open commitment · ${dueLabel}`,
          createdAt: cm.createdAt.toISOString(),
          source: { entityKind: "commitment", entityId: cm.id },
        });
      }
      for (const a of artifacts) {
        const haystack = `${a.title} ${a.body ?? ""}`.toLowerCase();
        if (q && !haystack.includes(q)) continue;
        hits.push({
          type: "graph",
          title: a.title,
          body: a.body ? a.body.slice(0, 240) : `${a.kind} · authored by ${a.agentRole ?? "agent"}`,
          createdAt: a.createdAt.toISOString(),
          source: {
            entityKind: "artifact",
            entityId: a.id,
            agentId: a.agentId,
            agentRole: a.agentRole,
            runId: a.runId,
          },
        });
      }
    } catch (err) {
      console.warn("[memory] knowledge-graph lookup failed:", err);
    }
  }

  // ─── 5. Activity feed (tasks + agent relays) ─────────────────────────────
  if (types.includes("activity")) {
    try {
      const items = await getActivityFeed(opts.companyId, perSourceLimit * 2);
      for (const item of items.slice(0, perSourceLimit)) {
        if (
          q &&
          !`${item.title} ${item.detail ?? ""}`.toLowerCase().includes(q)
        )
          continue;
        hits.push({
          type: "activity",
          title: item.title,
          body: item.detail ?? `${item.type} · ${item.status}`,
          createdAt: item.created_at,
          source: { agentId: item.agent_id, agentRole: item.agent_role },
        });
      }
    } catch (err) {
      console.warn("[memory] activity feed lookup failed:", err);
    }
  }

  // ─── Sort: vault hits by score (when present), then everything by recency
  hits.sort((a, b) => {
    // vault hits with scores rank above the rest when query provided
    if (a.score !== undefined && b.score === undefined) return -1;
    if (b.score !== undefined && a.score === undefined) return 1;
    if (a.score !== undefined && b.score !== undefined) return b.score - a.score;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  return hits.slice(0, limit);
}

/**
 * Summary counts for the /admin/memory header. One round-trip per source so
 * the page renders quickly without doing the full merge.
 */
export interface MemorySummary {
  memoryEntries: number;
  lessons: number;
  vaultDocs: number;
  recentActivity: number;
  /** Graph entity counts. Populated once migrations 007/008 are applied
   *  and Memory ingestion produces structured entities. */
  graphConversations: number;
  graphDecisions: number;
  graphOpenCommitments: number;
  graphArtifacts: number;
}

export async function summarizeCompanyMemory(
  companyId: string
): Promise<MemorySummary> {
  let memoryEntries = 0;
  let lessons = 0;
  let vaultDocs = 0;
  let recentActivity = 0;

  try {
    const agents = await getAgentsByCompany(companyId);
    const agentIds = agents.map((a) => a.id);
    if (agentIds.length > 0) {
      const byAgent = await getMemoryByAgentIds(agentIds);
      memoryEntries = Object.values(byAgent).reduce(
        (sum, entries) => sum + entries.length,
        0
      );
      for (const agent of agents) {
        const recent = await buildLessonsHelper({
          firmId: companyId,
          agentId: agent.id,
        }).readRecent({ limit: 100 });
        lessons += recent.length;
      }
    }
  } catch (err) {
    console.warn("[memory] summary agent counts failed:", err);
  }

  try {
    const { sql } = await import("./db-postgres");
    if (sql) {
      const rows = (await sql`
        SELECT count(*)::int AS n FROM vault_documents WHERE company_id = ${companyId}
      `) as Array<{ n: number }>;
      vaultDocs = rows[0]?.n ?? 0;
    }
  } catch (err) {
    console.warn("[memory] vault doc count failed:", err);
  }

  try {
    const items = await getActivityFeed(companyId, 100);
    recentActivity = items.length;
  } catch (err) {
    console.warn("[memory] activity count failed:", err);
  }

  // Graph counts are no-ops without DATABASE_URL — see knowledge-graph.ts
  const graph = await summarizeKnowledgeGraph(companyId);

  return {
    memoryEntries,
    lessons,
    vaultDocs,
    recentActivity,
    graphConversations: graph.conversations,
    graphDecisions: graph.decisions,
    graphOpenCommitments: graph.openCommitments,
    graphArtifacts: graph.artifacts,
  };
}
