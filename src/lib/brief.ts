/**
 * Pre-meeting brief generator — synthesises the knowledge graph into a
 * structured brief for an upcoming meeting.
 *
 * Inputs:
 *   - companyId
 *   - eventTitle  (e.g. "Acme quarterly review")
 *   - attendees   (emails or names — used to filter relevant context)
 *   - occurredAt? (anchor time; defaults to now)
 *
 * Pipeline:
 *   1. Query the graph for everything relevant to the attendees:
 *      - Open commitments where the attendee is the owner or recipient
 *      - Recent conversations that mention an attendee's name in title/transcript
 *      - Recent decisions
 *   2. Call Claude with a structured "brief" prompt; ask for markdown
 *   3. Return { markdown, sources: { commitmentIds, conversationIds, decisionIds } }
 *
 * Degrades gracefully:
 *   - No DATABASE_URL → returns a brief saying the graph is empty
 *   - No ANTHROPIC_API_KEY → returns a deterministic markdown rendering of
 *     the raw graph items (no Claude synthesis)
 *
 * Tests in test/brief.test.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getOpenCommitments,
  getRecentConversations,
  getRecentDecisions,
  type Commitment,
  type Conversation,
  type Decision,
} from "./knowledge-graph";

export interface BriefRequest {
  companyId: string;
  eventTitle: string;
  attendees: string[];
  /** Anchor time. Defaults to now. */
  occurredAt?: Date;
  /**
   * Clerk user id of the human the brief is for. When set, their own private
   * graph rows are included alongside the shared brain. Omit for system/cron
   * briefs (company-shared only). See migration 010.
   */
  viewerUserId?: string;
}

export interface BriefResult {
  markdown: string;
  sources: {
    commitmentIds: string[];
    conversationIds: string[];
    decisionIds: string[];
  };
  /** True when Claude synthesised; false when we fell back to deterministic render. */
  llmRan: boolean;
}

export interface BriefOptions {
  client?: Anthropic;
  model?: string;
  /** Per-source soft cap. Default 10. */
  perSourceLimit?: number;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function generateBrief(
  req: BriefRequest,
  options: BriefOptions = {}
): Promise<BriefResult> {
  const perSourceLimit = options.perSourceLimit ?? 10;

  // Pull the candidate items from the graph in parallel. The viewer (when the
  // brief is for a specific human) also sees their own private rows; a system /
  // cron brief passes no viewer and stays company-shared only.
  const viewer = { viewerUserId: req.viewerUserId };
  const [commitments, conversations, decisions] = await Promise.all([
    getOpenCommitments(req.companyId, perSourceLimit * 3, viewer),
    getRecentConversations(req.companyId, perSourceLimit * 3, viewer),
    getRecentDecisions(req.companyId, perSourceLimit * 2, viewer),
  ]);

  // Filter to items relevant to the attendees (case-insensitive substring
  // match on the attendee name/email against transcript+title for
  // conversations, description for commitments).
  const attendeeKeys = req.attendees
    .map((a) => a.toLowerCase().trim())
    .filter(Boolean);

  const relevantCommitments = commitments
    .filter((c) => {
      if (attendeeKeys.length === 0) return true;
      const hay = c.description.toLowerCase();
      return attendeeKeys.some((k) => hay.includes(k));
    })
    .slice(0, perSourceLimit);

  const relevantConversations = conversations
    .filter((c) => {
      if (attendeeKeys.length === 0) return true;
      const hay = `${c.title ?? ""} ${c.transcript ?? ""}`.toLowerCase();
      return attendeeKeys.some((k) => hay.includes(k));
    })
    .slice(0, perSourceLimit);

  const relevantDecisions = decisions.slice(0, perSourceLimit);

  const sources = {
    commitmentIds: relevantCommitments.map((c) => c.id),
    conversationIds: relevantConversations.map((c) => c.id),
    decisionIds: relevantDecisions.map((d) => d.id),
  };

  // Try Claude synthesis; otherwise fall back to a deterministic render.
  const hasApiKey = Boolean(options.client) || Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasApiKey) {
    return {
      markdown: deterministicRender(req, {
        commitments: relevantCommitments,
        conversations: relevantConversations,
        decisions: relevantDecisions,
      }),
      sources,
      llmRan: false,
    };
  }

  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_MODEL;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: BRIEF_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildBriefPrompt(req, {
            commitments: relevantCommitments,
            conversations: relevantConversations,
            decisions: relevantDecisions,
          }),
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    return { markdown: text, sources, llmRan: true };
  } catch (err) {
    console.warn("[brief] Claude call failed; falling back to render:", err);
    return {
      markdown: deterministicRender(req, {
        commitments: relevantCommitments,
        conversations: relevantConversations,
        decisions: relevantDecisions,
      }),
      sources,
      llmRan: false,
    };
  }
}

// ─── Prompt + deterministic render ─────────────────────────────────────────

const BRIEF_SYSTEM_PROMPT = `You are a chief of staff preparing an executive
for an upcoming meeting. Your output is a tight, scannable Markdown brief
in this exact structure:

## Why this meeting matters
- 1-2 bullets that frame the stakes for the audience.

## What you've promised them
- Each open commitment to/from an attendee, with the due date when known.

## What was decided last
- Each recent decision relevant to the topic, attributed to a person.

## Open threads
- Each recent conversation surfaced from the graph, summarised in 1 line.

## You should go in expecting
- 1-2 bullets that anticipate the audience's framing or asks.

Rules:
- Be terse. No filler, no greeting, no closing.
- Never invent facts; only use items from the supplied graph payload.
- Use exact names from the payload. If a field is missing, omit the line.
- If a section has zero relevant items, write "Nothing new on file." under that header.`;

function buildBriefPrompt(
  req: BriefRequest,
  ctx: {
    commitments: Commitment[];
    conversations: Conversation[];
    decisions: Decision[];
  }
): string {
  const occurredAt = (req.occurredAt ?? new Date()).toISOString();
  const lines = [
    `Meeting: ${req.eventTitle}`,
    `When: ${occurredAt}`,
    `Attendees: ${req.attendees.join(", ") || "(unknown)"}`,
    "",
    "### Commitments (open)",
    ctx.commitments.length === 0
      ? "(none on file)"
      : ctx.commitments
          .map((c) => {
            const due = c.dueAt ? c.dueAt.toISOString().slice(0, 10) : "no due date";
            return `- ${c.description} · due ${due}`;
          })
          .join("\n"),
    "",
    "### Decisions (recent)",
    ctx.decisions.length === 0
      ? "(none on file)"
      : ctx.decisions
          .map((d) => {
            const by = d.decidedBy ? ` by ${d.decidedBy}` : "";
            const cat = d.category ? ` [${d.category}]` : "";
            return `- ${d.title}${by}${cat}${d.detail ? ` — ${d.detail}` : ""}`;
          })
          .join("\n"),
    "",
    "### Conversations (recent)",
    ctx.conversations.length === 0
      ? "(none on file)"
      : ctx.conversations
          .map((c) => {
            const when = c.occurredAt
              ? c.occurredAt.toISOString().slice(0, 10)
              : c.createdAt.toISOString().slice(0, 10);
            const head = c.title ?? `${c.kind} conversation`;
            const snippet = c.transcript
              ? c.transcript.replace(/\s+/g, " ").slice(0, 240)
              : "";
            return `- [${when}] ${head}${snippet ? " — " + snippet : ""}`;
          })
          .join("\n"),
    "",
    "Write the brief now.",
  ];
  return lines.join("\n");
}

function deterministicRender(
  req: BriefRequest,
  ctx: {
    commitments: Commitment[];
    conversations: Conversation[];
    decisions: Decision[];
  }
): string {
  const out: string[] = [];
  out.push(`# Pre-meeting brief: ${req.eventTitle}`);
  out.push("");
  if (req.attendees.length > 0) {
    out.push(`Attendees: ${req.attendees.join(", ")}`);
    out.push("");
  }

  out.push("## What you've promised them");
  if (ctx.commitments.length === 0) {
    out.push("Nothing new on file.");
  } else {
    for (const c of ctx.commitments) {
      const due = c.dueAt
        ? c.dueAt.toISOString().slice(0, 10)
        : "no due date";
      out.push(`- ${c.description} (due ${due})`);
    }
  }
  out.push("");

  out.push("## What was decided last");
  if (ctx.decisions.length === 0) {
    out.push("Nothing new on file.");
  } else {
    for (const d of ctx.decisions) {
      const by = d.decidedBy ? ` — ${d.decidedBy}` : "";
      out.push(`- **${d.title}**${by}`);
      if (d.detail) out.push(`  ${d.detail}`);
    }
  }
  out.push("");

  out.push("## Open threads");
  if (ctx.conversations.length === 0) {
    out.push("Nothing new on file.");
  } else {
    for (const c of ctx.conversations) {
      const when = c.occurredAt
        ? c.occurredAt.toISOString().slice(0, 10)
        : c.createdAt.toISOString().slice(0, 10);
      const head = c.title ?? `${c.kind} conversation`;
      out.push(`- [${when}] ${head}`);
    }
  }
  out.push("");

  out.push("_Synthesised without Claude (ANTHROPIC_API_KEY unset). Configure the key for richer briefs._");
  return out.join("\n");
}

export const __test__ = { buildBriefPrompt, deterministicRender };
