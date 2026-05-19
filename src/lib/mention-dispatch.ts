/**
 * Mention dispatcher — parses `@Role` references in agent output and fires
 * inter-agent relay calls so the mentioned agent actually responds.
 *
 * The role-specific system prompts (src/lib/prompts.ts) already instruct
 * agents to use `@Sales`, `@Legal`, `@Admin`, etc. when they want to hand
 * a task off. The inter-agent relay endpoint (/api/agents/relay) already
 * implements the routing + persistence + depth cap. The piece missing was
 * the parser that connects an agent's outgoing message to the relay.
 *
 * This module is that connector. It's deliberately a separate file so the
 * chat handlers stay readable and so we can unit-test the parser without
 * spinning up the rest of the stack.
 *
 * Tests in test/mention-dispatch.test.ts.
 */

const ROLES_LONGEST_FIRST = [
  "Front-End Engineering",
  "Back-End Engineering",
  "Customer Success",
  "Data Analyst",
  "AI Expert",
  "Engineering",
  "Accounting",
  "Marketing",
  "Strategy",
  "Finance",
  "Product",
  "Admin",
  "Legal",
  "Sales",
  "CEO",
  "HR",
];

const ROLES_ALT = ROLES_LONGEST_FIRST
  .map((r) => r.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
  .join("|");

// Anchored on @ then a known role; word-boundary on right end.
// Longest first so "Customer Success" wins over "Customer" if that ever shows up.
const MENTION_RE = new RegExp(`@(${ROLES_ALT})(?![A-Za-z])`, "g");

/**
 * Extract unique role mentions from an arbitrary string. Case-sensitive on
 * the role name (agents are instructed to use exact role casing in prompts).
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(MENTION_RE);
  const unique = new Set<string>();
  for (const m of matches) {
    unique.add(m[1]);
  }
  return [...unique];
}

export interface DispatchResult {
  role: string;
  status: "done" | "not_found" | "depth_exceeded" | "error" | "skipped";
  response?: string;
  error?: string;
}

export interface DispatchOptions {
  fromAgentId: string;
  conversationId?: string;
  content: string;
  depth?: number;
  /** Override the relay base URL (defaults to APP_BASE_URL / NEXT_PUBLIC_APP_URL / localhost). */
  baseUrl?: string;
  /** Allow tests to swap fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Detect every @Role mention in `content` and dispatch each as an inter-agent
 * relay. Fire-and-forget friendly: returns an array of per-role results that
 * can be awaited or ignored.
 *
 * Skips silently if INTERNAL_SECRET is unset (dev mode) — the chat path
 * still works, just without auto-routing.
 */
export async function dispatchMentions(
  opts: DispatchOptions
): Promise<DispatchResult[]> {
  const mentions = extractMentions(opts.content);
  if (mentions.length === 0) return [];

  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) {
    return mentions.map((role) => ({ role, status: "skipped" as const }));
  }

  const baseUrl =
    opts.baseUrl ??
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const fetchFn = opts.fetchImpl ?? fetch;

  const results: DispatchResult[] = [];
  for (const role of mentions) {
    try {
      const res = await fetchFn(`${baseUrl}/api/agents/relay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({
          sourceAgentId: opts.fromAgentId,
          targetRole: role,
          message: opts.content,
          conversationId: opts.conversationId,
          depth: opts.depth ?? 0,
        }),
      });
      if (!res.ok) {
        results.push({ role, status: "error", error: `HTTP ${res.status}` });
        continue;
      }
      const data = (await res.json()) as {
        response?: string;
        status?: DispatchResult["status"];
      };
      results.push({
        role,
        status: data.status ?? "done",
        response: data.response,
      });
    } catch (err) {
      results.push({
        role,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
