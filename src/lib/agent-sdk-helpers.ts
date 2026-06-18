/**
 * Agent SDK helper interfaces — the shared surface every agent template
 * composes from. Decision 2A-B (eng-review locked) bakes these into the SDK
 * so the 31 CA-pack agents (and future verticals) don't reimplement common
 * patterns.
 *
 * Implementations land in their respective workstream PRs:
 *   - whatsapp.* → W4 (WhatsApp BSP router)
 *   - vault.*    → W5 (Vault knowledge base module)
 *   - lessons.*  → ships in this PR's follow-up (lessons table is a thin
 *                  wrapper over the existing `memory` table)
 *   - escalation.* → composes whatsapp + admin portal notifications
 *
 * This file ships interfaces only. A stub implementation that throws
 * "not yet implemented" is exported as `createStubHelpers()` for the
 * reference agent + tests.
 */

import type { AgentRunContext } from "./agent-sdk";

// ─── WhatsApp approval helper ──────────────────────────────────────────────

export interface ApprovalCardOptions {
  /** Recipient WhatsApp phone (E.164). The router resolves this to a tenant. */
  to: string;
  /** Title shown at top of the card. ≤ 60 chars. */
  title: string;
  /** Body text. ≤ 1024 chars. Used for preview before approval. */
  body: string;
  /**
   * The action that gets executed if the user clicks Approve. The platform
   * stores this opaquely; the agent's afterRun handler is responsible for
   * actually performing the action when the approval callback fires.
   */
  payload: Record<string, unknown>;
  /** Defaults: ["Approve", "Reject"]. Custom labels supported by some BSPs. */
  buttons?: { approve: string; reject: string; escalate?: string };
  /** Callback URL expiry in seconds. Default 7 days. */
  expirySeconds?: number;
}

export interface ApprovalCardResult {
  /** Stable id for the sent card. Use it to query approval status later. */
  cardId: string;
  /** WhatsApp message id from the BSP. */
  messageId: string;
}

export interface WhatsAppHelper {
  sendApprovalCard(opts: ApprovalCardOptions): Promise<ApprovalCardResult>;
  sendNotification(opts: {
    to: string;
    body: string;
    template?: string;
    templateParams?: string[];
  }): Promise<{ messageId: string }>;
}

// ─── Vault helper ──────────────────────────────────────────────────────────

export interface VaultQueryOptions {
  /** Free-text query. Embedded and matched against the per-tenant pgvector index. */
  q: string;
  /** Max chunks to return. Default 5. */
  limit?: number;
  /** Optional structured filter, e.g. `{ doc_type: "engagement_letter" }`. */
  filter?: Record<string, unknown>;
}

export interface VaultChunk {
  chunkId: string;
  text: string;
  /** Provenance: where this chunk came from. Always cited in agent output. */
  source: {
    docId: string;
    docTitle: string;
    page?: number;
    paragraph?: number;
  };
  /** Cosine similarity score in [0, 1]. */
  score: number;
}

export interface VaultHelper {
  query(opts: VaultQueryOptions): Promise<VaultChunk[]>;
  /** Ingest a new document. Returns the doc id once chunking + embedding completes. */
  ingest(opts: {
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ docId: string; chunkCount: number }>;
}

// ─── Lessons helper ────────────────────────────────────────────────────────
// Cross-run learning loop. Each run writes a structured lesson; subsequent
// runs read recent lessons before executing.

export interface LessonRecord {
  agentId: string;
  runId: string;
  taskDescription: string;
  outputAccepted: "approved" | "rejected" | "modified" | "unknown";
  modificationDetail?: string;
  selfCritique?: string;
  createdAt: Date;
}

export interface LessonsHelper {
  /** Read N most recent lessons for this agent (per tenant). Default 5. */
  readRecent(opts?: { limit?: number }): Promise<LessonRecord[]>;
  write(record: Omit<LessonRecord, "createdAt">): Promise<void>;
}

// ─── Escalation helper ─────────────────────────────────────────────────────

export interface EscalationHelper {
  /** Hand off to a different agent in the same firm. The handoff message is logged. */
  handoff(opts: { toAgentId: string; reason: string; context?: Record<string, unknown> }): Promise<void>;
  /** Alert the SPOC via WhatsApp + admin portal. Use for Tally-offline, KMS issues, etc. */
  alertSpoc(opts: { severity: "P1" | "P2" | "P3"; subject: string; detail: string }): Promise<void>;
  /** Escalate to a human team member (e.g. partner approval needed). */
  escalateToHuman(opts: { roleHint: string; subject: string; detail: string }): Promise<void>;
}

// ─── Memory helper ─────────────────────────────────────────────────────────
// The shared company brain, exposed to an agent's beforeRun. Folds together the
// 5 memory sources (agent KV, lessons, vault, activity, and the knowledge graph
// of meetings/decisions/commitments) behind one query. Agents read as the
// COMPANY — they carry no user identity — so private captures are never
// returned (migration 010/011). This is the link that lets a meeting recorded
// by one person inform an agent acting later.

export interface MemoryRecallHit {
  type: "memory" | "lesson" | "vault" | "activity" | "graph";
  title: string;
  /** Always present (queryCompanyMemory sets it); may be empty string. */
  body: string;
  /** Relevance score when the source is ranked (e.g. vault semantic search). */
  score?: number;
  source: { agentRole?: string; docId?: string; runId?: string };
  createdAt: string;
}

export interface MemoryHelper {
  /**
   * Recall relevant context from the shared brain. `query` ranks/filters across
   * sources; omit it for the most recent shared context. Default limit 8.
   * Company-shared only — an agent never sees a member's private rows.
   */
  recall(opts?: { query?: string; limit?: number }): Promise<MemoryRecallHit[]>;
}

// ─── Bundle ────────────────────────────────────────────────────────────────

export interface AgentHelpers {
  whatsapp: WhatsAppHelper;
  vault: VaultHelper;
  lessons: LessonsHelper;
  escalation: EscalationHelper;
  memory: MemoryHelper;
}

// ─── Stub implementation ───────────────────────────────────────────────────
// Used in tests and the A4 reference example until the workstream PRs land.
// Every method throws "not yet implemented". Tests that need behavior pass
// their own mocks via the test harness (see test/agent-sdk.test.ts).

export function createStubHelpers(): AgentHelpers {
  const notImpl = (fn: string) => () => {
    throw new Error(`AgentHelpers.${fn} not implemented yet — see workstream PR roadmap`);
  };
  return {
    whatsapp: {
      sendApprovalCard: notImpl("whatsapp.sendApprovalCard"),
      sendNotification: notImpl("whatsapp.sendNotification"),
    },
    vault: {
      query: notImpl("vault.query"),
      ingest: notImpl("vault.ingest"),
    },
    lessons: {
      readRecent: notImpl("lessons.readRecent"),
      write: notImpl("lessons.write"),
    },
    escalation: {
      handoff: notImpl("escalation.handoff"),
      alertSpoc: notImpl("escalation.alertSpoc"),
      escalateToHuman: notImpl("escalation.escalateToHuman"),
    },
    memory: {
      recall: notImpl("memory.recall"),
    },
  };
}

// Re-export AgentRunContext so consumers don't need a separate import.
export type { AgentRunContext };
