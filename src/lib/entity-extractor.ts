/**
 * Entity extractor — takes a conversation transcript (or any text source)
 * and fills the v3 knowledge-graph tables.
 *
 * Pipeline:
 *   1. INSERT a conversations row (the canonical record of the captured turn)
 *   2. Call Claude with a single tool — extract_entities — that returns a
 *      structured bundle of persons, decisions, commitments
 *   3. INSERT each entity (dedup persons by email | lowercase name)
 *   4. INSERT knowledge_edges linking everything back to the conversation
 *
 * Result: a fully populated subgraph that queryCompanyMemory + the future
 * /admin/memory graph viewer can traverse.
 *
 * Designed to be safe to call without a DB (returns a stub). Designed to
 * be safe to call without ANTHROPIC_API_KEY (returns the conversation row
 * with empty extraction so the caller can still persist the transcript).
 *
 * Tests in test/entity-extractor.test.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  createConversation,
  createPerson,
  createDecision,
  createCommitment,
  createEdge,
  type Conversation,
  type ConversationKind,
} from "./knowledge-graph";

// ─── Tool schema ───────────────────────────────────────────────────────────

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_entities",
  description:
    "Extract every person, decision, and commitment mentioned in the transcript. " +
    "Be conservative — only include items explicitly stated. Use the speaker's own words for descriptions.",
  input_schema: {
    type: "object",
    properties: {
      persons: {
        type: "array",
        description:
          "Every person mentioned by name in the transcript. Include both internal teammates and external contacts.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Full name as mentioned." },
            email: {
              type: "string",
              description: "Email address if explicitly stated.",
            },
            role: {
              type: "string",
              description: "Job title / relationship if stated.",
            },
            isExternal: {
              type: "boolean",
              description:
                "true = external contact (customer / vendor / prospect); false = internal teammate.",
            },
          },
          required: ["name"],
        },
      },
      decisions: {
        type: "array",
        description: "Durable decisions made or confirmed in this conversation.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short title (≤ 100 chars) summarising the decision.",
            },
            detail: {
              type: "string",
              description: "Full context in 1-3 sentences.",
            },
            decidedBy: {
              type: "string",
              description: "Person who made the call, if attributable.",
            },
            category: {
              type: "string",
              description:
                "Optional grouping: pricing | hiring | product | gtm | finance | legal | other",
            },
          },
          required: ["title"],
        },
      },
      commitments: {
        type: "array",
        description:
          "Open promises / action items with a person owning them. Skip generic 'we should …' unless someone owned it.",
        items: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "What was promised, in the speaker's own framing.",
            },
            committedByName: {
              type: "string",
              description: "Name of the person who made the promise.",
            },
            committedToName: {
              type: "string",
              description: "Name of the person it was promised to (if any).",
            },
            dueAt: {
              type: "string",
              description:
                "ISO-8601 date or datetime if a deadline was stated; otherwise omit.",
            },
          },
          required: ["description"],
        },
      },
    },
    required: ["persons", "decisions", "commitments"],
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface ExtractedPerson {
  name: string;
  email?: string;
  role?: string;
  isExternal?: boolean;
}
interface ExtractedDecision {
  title: string;
  detail?: string;
  decidedBy?: string;
  category?: string;
}
interface ExtractedCommitment {
  description: string;
  committedByName?: string;
  committedToName?: string;
  dueAt?: string;
}

interface ExtractedBundle {
  persons: ExtractedPerson[];
  decisions: ExtractedDecision[];
  commitments: ExtractedCommitment[];
}

const EMPTY_BUNDLE: ExtractedBundle = {
  persons: [],
  decisions: [],
  commitments: [],
};

export interface ExtractionInput {
  companyId: string;
  text: string;
  kind?: ConversationKind;
  title?: string;
  occurredAt?: Date;
  source?: string;
  sourceRef?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  conversation: Conversation | null;
  personIds: string[];
  decisionIds: string[];
  commitmentIds: string[];
  edgesCreated: number;
  /** True when Claude was called and returned a bundle; false in dev / no-key mode. */
  llmRan: boolean;
}

/**
 * Optional: caller can inject an Anthropic-like client (for tests).
 */
export interface ExtractorOptions {
  client?: Anthropic;
  model?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TEXT_FOR_EXTRACTION = 40_000; // ~10k tokens — pragmatic cap

// ─── Pipeline ──────────────────────────────────────────────────────────────

export async function ingestConversation(
  input: ExtractionInput,
  options: ExtractorOptions = {}
): Promise<ExtractionResult> {
  // 1. Persist the conversation row first so we have an id to link edges to.
  const conversation = await createConversation({
    companyId: input.companyId,
    kind: input.kind ?? "note",
    title: input.title,
    occurredAt: input.occurredAt,
    source: input.source,
    sourceRef: input.sourceRef,
    transcript: input.text,
    metadata: input.metadata,
  });

  // No DB → return early. Caller sees conversation: null and knows no
  // entity rows exist either.
  if (!conversation) {
    return {
      conversation: null,
      personIds: [],
      decisionIds: [],
      commitmentIds: [],
      edgesCreated: 0,
      llmRan: false,
    };
  }

  // 2. Call Claude to extract entities — gracefully skip without API key.
  const bundle = await extractWithClaude(
    input.text.slice(0, MAX_TEXT_FOR_EXTRACTION),
    options
  );
  if (bundle === null) {
    return {
      conversation,
      personIds: [],
      decisionIds: [],
      commitmentIds: [],
      edgesCreated: 0,
      llmRan: false,
    };
  }

  // 3. Persist persons (dedup by email lowercase, then by lowercase name).
  // Track local key → personId so commitments can resolve names to ids.
  const personIdByKey = new Map<string, string>();
  const personIds: string[] = [];
  for (const p of bundle.persons) {
    const created = await createPerson({
      companyId: input.companyId,
      name: p.name,
      email: p.email,
      role: p.role,
      isExternal: p.isExternal ?? true,
    });
    if (created) {
      personIds.push(created.id);
      if (p.email) personIdByKey.set(`email:${p.email.toLowerCase()}`, created.id);
      personIdByKey.set(`name:${p.name.toLowerCase()}`, created.id);
    }
  }

  // 4. Persist decisions, link to conversation.
  const decisionIds: string[] = [];
  for (const d of bundle.decisions) {
    const created = await createDecision({
      companyId: input.companyId,
      title: d.title,
      detail: d.detail,
      decidedBy: d.decidedBy,
      category: d.category,
    });
    if (created) decisionIds.push(created.id);
  }

  // 5. Persist commitments, resolve owner/recipient by name to person ids.
  const commitmentIds: string[] = [];
  for (const c of bundle.commitments) {
    const committedBy =
      c.committedByName &&
      personIdByKey.get(`name:${c.committedByName.toLowerCase()}`);
    const committedTo =
      c.committedToName &&
      personIdByKey.get(`name:${c.committedToName.toLowerCase()}`);
    const created = await createCommitment({
      companyId: input.companyId,
      description: c.description,
      committedBy: committedBy ?? undefined,
      committedTo: committedTo ?? undefined,
      dueAt: c.dueAt ? new Date(c.dueAt) : undefined,
      sourceConversationId: conversation.id,
    });
    if (created) commitmentIds.push(created.id);
  }

  // 6. Edges — every person attended the conversation; conversation
  // resulted_in each decision; conversation produced each commitment.
  let edgesCreated = 0;
  const tryEdge = async (
    sourceType: string,
    sourceId: string,
    relation: string,
    targetType: string,
    targetId: string
  ) => {
    const edge = await createEdge({
      companyId: input.companyId,
      sourceType,
      sourceId,
      relation,
      targetType,
      targetId,
    });
    if (edge) edgesCreated++;
  };
  for (const pid of personIds) {
    await tryEdge("person", pid, "attended", "conversation", conversation.id);
  }
  for (const did of decisionIds) {
    await tryEdge(
      "conversation",
      conversation.id,
      "resulted_in",
      "decision",
      did
    );
  }
  for (const cid of commitmentIds) {
    await tryEdge(
      "conversation",
      conversation.id,
      "produced",
      "commitment",
      cid
    );
  }

  return {
    conversation,
    personIds,
    decisionIds,
    commitmentIds,
    edgesCreated,
    llmRan: true,
  };
}

/**
 * Call Claude with the extract_entities tool and return the parsed bundle.
 * Returns null when the call fails or no API key is configured — the caller
 * still persists the conversation row, just without the extracted entities.
 */
async function extractWithClaude(
  text: string,
  options: ExtractorOptions
): Promise<ExtractedBundle | null> {
  // Without an API key, return null so the caller reports llmRan=false
  // and skips entity creation entirely. The conversation row is still
  // persisted by ingestConversation.
  if (!options.client && !process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_MODEL;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system:
        "You extract structured entities from business conversation transcripts. " +
        "Be precise; only include items the transcript explicitly mentions. " +
        "Call the extract_entities tool exactly once.",
      messages: [
        {
          role: "user",
          content: `Extract every person, decision, and commitment from this transcript.\n\n---TRANSCRIPT---\n${text}\n---END TRANSCRIPT---`,
        },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_entities" },
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use") as
      | { type: "tool_use"; input: ExtractedBundle }
      | undefined;
    if (!toolBlock) return EMPTY_BUNDLE;
    return normalizeBundle(toolBlock.input);
  } catch (err) {
    console.warn("[entity-extractor] Claude call failed:", err);
    return null;
  }
}

function normalizeBundle(raw: ExtractedBundle): ExtractedBundle {
  return {
    persons: Array.isArray(raw.persons)
      ? raw.persons.filter((p) => p && typeof p.name === "string" && p.name.trim())
      : [],
    decisions: Array.isArray(raw.decisions)
      ? raw.decisions.filter(
          (d) => d && typeof d.title === "string" && d.title.trim()
        )
      : [],
    commitments: Array.isArray(raw.commitments)
      ? raw.commitments.filter(
          (c) =>
            c && typeof c.description === "string" && c.description.trim()
        )
      : [],
  };
}

/** Exported for tests. */
export const __test__ = { extractWithClaude, normalizeBundle, EXTRACT_TOOL };
