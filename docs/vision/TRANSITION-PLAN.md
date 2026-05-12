# Transition Plan — v1 → v2 Vision Alignment

> **Status:** Draft for approval · **Author:** Abhinav Ramesh · **Date:** 2026-05-12
> **Goal:** Align the existing platform with the v2 vision (`docs/vision/PRD.md`) with the **minimum possible changes**. No rebuilding what already works.
> **Read this in place of the PRD's Phase 1–9.** The PRD describes the destination; this file describes the diff.

---

## 1. The headline finding

**v2 is mostly already built.** A deep code audit shows that ~80% of what the PRD prescribed already exists in `src/lib/**`, `src/app/api/**`, and `src/app/admin/**`. The original PRD treated several major systems as net-new when they're already shipping. This plan replaces the PRD's nine-phase rebuild with a focused **delta-only** execution that takes **~5–7 working days** instead of 28.

---

## 2. Inventory — what already exists (do not rebuild)

| Capability | Where it lives | Status |
|---|---|---|
| **Typed Agent SDK** | `src/lib/agent-sdk.ts`, `agent-sdk-helpers.ts` | ✅ Full surface: TriggerSpec, ToolBinding, ConfigSchema, AgentBudget, Observability, AgentRunContext |
| **Agent Runner with tool-use loop** | `src/lib/agent-runner.ts` | ✅ Budget enforcement, retry, Langfuse-shaped trace, mock-LLM abstraction, lifecycle hooks (beforeRun/afterRun/onError) |
| **CEO orchestrator tools** | `src/lib/mcp/ceo-tools.ts` | ✅ `query_all_agents`, `get_company_metrics`, `delegate_task` with anti-runaway delegation cap (tested in `test/ceo-tools.test.ts`) |
| **Inter-agent message bus** | `db.createInterAgentMessage`, `completeInterAgentMessage`, `/api/agents/relay/route.ts` | ✅ Both DB + relay API live |
| **Role-specific prompts with `@mention` semantics** | `src/lib/prompts.ts` | ✅ Sales/Marketing/Accounting/Strategy/Product+ already prompted to use `@Sales`, `@Legal`, `@Admin`, `@Product` |
| **Chai Time daily cross-agent sync** | `src/lib/chai-time.ts`, `/api/chai-time/route.ts` | ✅ Daily standup-style context exchange between every agent — *this is the shared-knowledge loop the PRD asked for* |
| **Daily Debrief + push fallback chain** | `src/lib/debrief.ts`, `/api/debrief/*` | ✅ Telegram → Email → Dashboard fallback |
| **Tool registry for 13 roles** | `src/lib/mcp/registry.ts` | ✅ Per-tool category, provider, requiresApiKey, platformProvided, envVar |
| **Real MCP tool implementations** | `src/lib/mcp/{apollo,instantly,web-search}.ts` | ✅ Apollo prospecting, Instantly outreach, Exa web search all wired |
| **BYOK / user-supplied tool keys** | `db-sqlite.ts:user_api_keys`, `db-postgres.ts:user_api_keys`, `/api/user-keys/route.ts` | ✅ Per-company per-service encrypted keys (used today for Apollo/Instantly; trivially extends to LLM providers) |
| **Public developer API (v1)** | `/api/v1/{agents,chat,tasks}`, `src/lib/api-auth.ts`, `api-keys.ts` | ✅ API-key authenticated; supports agent listing, chat, task creation |
| **Background task queue** | `src/lib/task-processor.ts`, `db.createTask/updateTaskStatus/getNextQueuedTask`, `/api/tasks/process` | ✅ With retries + max-attempts |
| **Agent eval system** | `src/lib/eval-judge.ts`, `eval-test-suites.ts`, `/api/evals/*` | ✅ Claude Haiku as judge; test suites per role |
| **Industry packs + 30-day plans** | `src/lib/agent-templates.ts`, `suggested-platforms.ts` | ✅ SaaS pack + extensible structure |
| **Credits + Stripe billing** | `src/lib/stripe.ts`, `/api/billing/{checkout,portal,webhook}`, `db.getCredits/deductCredits/CREDITS_PER_PROMPT` | ✅ Metered billing live |
| **Vault: pgvector + Cohere + entity extraction** | `src/lib/vault.ts`, `vault-extractors.ts`, migrations 002 | ✅ 18 tests passing |
| **Lessons read/write** | `src/lib/lessons.ts`, migrations 003 | ✅ 7 tests passing |
| **Escalation helper** | `src/lib/escalation.ts` | ✅ handoff + alertSpoc + escalateToHuman |
| **Tenant context (ALS) + RLS** | `src/lib/tenant-context.ts`, migrations 001 | ✅ AsyncLocalStorage + Postgres RLS helpers |
| **Tenant provisioner state machine** | `src/lib/tenant-provisioner.ts`, migrations 004 | ✅ 8 tests passing |
| **Memory waitlist** | `/api/memory-waitlist/route.ts`, `src/app/memory/page.tsx` (572 lines) | ✅ Waitlist active |
| **Two live demo verticals** | `src/app/admin/{shopify,timesheets}/*` | ✅ Shopify Editor + Telegram timesheets, live-verified against real customers |
| **Admin shell (12 pages)** | `src/app/admin/{,agents,agents/[role],agents/[role]/[runId],approvals,integrations,notifications,provisioning,shopify,timesheets,vault}/page.tsx` | ✅ With sidebar, topbar, toasts, send-burst, primitives |
| **Onboarding + provisioning flow** | `src/app/onboarding/page.tsx`, `provisioning/[companyId]/page.tsx`, `/api/companies`, `/api/provisioning/[companyId]` | ✅ Real Clerk → company → provision → /admin |
| **Custom skills CRUD** | `db.getCustomSkills/addCustomSkill/removeCustomSkill`, `/api/agents/skills` | ✅ Per-agent skill bag |
| **WhatsApp router** | `src/lib/whatsapp.ts`, `/api/messaging/whatsapp/{webhook,callback}` | ✅ Code-complete; pending Gupshup BSP signup |
| **Telegram router** | `src/lib/telegram.ts`, `/api/messaging/telegram` | ✅ Live with `@timesheettrial_bot` |
| **Auth gate** | `src/proxy.ts` (Next 16 proxy.ts) | ✅ Clerk gates `/admin/**`, `/onboarding`, `/provisioning`, `/api/{agents,companies,profile,provisioning,shopify,timesheets}/**` |

**Bottom line: the v2 mental model — closed loop, shared memory, CEO orchestrator, role agents with real tools, BYOM, inter-agent collab — is *largely already there in code*. What's missing is wiring, surface, and deployment.**

---

## 3. The actual gap (eight items)

Each item below is **surgical** — small, scoped, and additive. Nothing existing is replaced.

### Gap 1 — Apply approved landing copy

**Files touched:** `src/app/page.tsx`, `src/app/memory/page.tsx`
**Effort:** half-day
**Diff:** Replace section copy with content from `docs/vision/landing-copy.md` §A and §B. Keep existing component scaffolding, DESIGN.md tokens, and Navbar/Footer. No new dependencies.

---

### Gap 2 — Inject recent Lessons into chat path

**Why:** The vision's "closed-loop learning" promise depends on agents *reading* lessons before each response. Today `lessons.ts` writes lessons but `/api/chat` doesn't read them.

**Files touched:** `src/app/api/chat/route.ts`, `src/app/api/v1/chat/route.ts`
**Effort:** half-day
**Diff:**
```ts
// Before the Anthropic call, after loading the agent:
import { buildLessonsHelper } from "@/lib/lessons";
const lessons = await buildLessonsHelper(companyId).readRecent({ role: agent.role, k: 5 });
const lessonsBlock = lessons.length
  ? `\n\nRecent lessons learned by you and other agents:\n${lessons.map(l => `- ${l.content}`).join("\n")}`
  : "";
// Append lessonsBlock to system prompt
```
Apply same diff in `/api/v1/chat`. Add test in `test/lessons.test.ts` that confirms `readRecent` is called.

---

### Gap 3 — Parse `@mentions` in agent responses → enqueue inter-agent message

**Why:** Prompts already instruct agents to `@Role` for handoff (`prompts.ts:22, 30, 102`), and `createInterAgentMessage` exists in db. The piece missing is the parser that detects `@Role` in an assistant message and fires the relay.

**Files touched:** `src/lib/mention-dispatch.ts` (new, ~80 lines), `src/app/api/chat/route.ts`, `src/app/api/v1/chat/route.ts`
**Effort:** 1 day
**Diff sketch:**
```ts
// src/lib/mention-dispatch.ts
const MENTION_RE = /@(Sales|Marketing|Legal|Finance|HR|Admin|Strategy|Product|Customer Success|Engineering|AI Expert|Data Analyst)\b/g;
export async function dispatchMentions(opts: { fromAgentId, companyId, content, conversationId }) {
  const matches = [...content.matchAll(MENTION_RE)];
  for (const m of matches) {
    const targetAgent = await findAgentByRole(companyId, m[1]);
    if (!targetAgent || targetAgent.id === fromAgentId) continue;
    await createInterAgentMessage({ from_agent_id: fromAgentId, to_agent_id: targetAgent.id, conversation_id: conversationId, payload: content });
  }
}
```
Call from chat route after assistant turn lands. Add test in `test/agents-relay.test.ts` (new).

---

### Gap 4 — Shared company memory (not per-agent)

**Why:** Today `getMemory(agentId)` returns per-agent key-value memory. The vision says agents share one brain. We already have `getMemoryByAgentIds(...)` in `db-sqlite.ts:1644` — just need a thin facade `getCompanyMemory(companyId)` that calls it for all agents in the company, plus a vault-search call, plus recent lessons.

**Files touched:** `src/lib/memory.ts` (new, ~120 lines), `src/lib/db.ts` (add `getCompanyMemory`)
**Effort:** 1 day
**Diff sketch:**
```ts
// src/lib/memory.ts
export async function queryCompanyMemory(opts: {
  companyId: string;
  query?: string;
  types?: ("memory" | "lesson" | "vault" | "activity")[];
  k?: number;
}): Promise<MemoryHit[]> {
  // 1. Per-agent key-value memory across all agents in the company
  // 2. Lessons (LessonsHelper.readRecent)
  // 3. Vault semantic search (vault.query)
  // 4. Recent activity feed (db.getActivityFeed)
  // → merge, rank, top-K
}
```
Call from chat route before the LLM call. No schema migration required — uses existing tables.

---

### Gap 5 — `/admin/memory` page

**Why:** Surface the shared brain for the user. Just a read-only viewer over what `queryCompanyMemory` returns.

**Files touched:** `src/app/admin/memory/page.tsx` (new), `src/app/admin/_lib/admin-data.ts` (add `loadCompanyMemory`), `src/app/admin/_components/sidebar.tsx` (add nav item), `src/app/admin/_components/icons.tsx` (add `BrainIcon`)
**Effort:** 1 day
**Diff:** Server-component page that lists vault docs + recent lessons + recent agent-memory entries grouped by source. Reuses existing `primitives.tsx` (`Pill`, `Section`, `DataRow`, `EmptyState`). Mock-fallback via existing pattern.

---

### Gap 6 — LLM provider BYOM (extend existing BYOK)

**Why:** `user_api_keys` already stores per-service encrypted keys. Today it's used for tool services (Apollo, Instantly). Extend with `service_name IN ('anthropic','openai','gemini','bedrock','azure','openai_compat')` and route LLM calls through a thin selector.

**Files touched:** `src/lib/llm-router.ts` (new, ~150 lines), `src/app/api/chat/route.ts`, `src/app/api/v1/chat/route.ts`, `src/app/admin/integrations/page.tsx` (add Models tab), `/api/user-keys/route.ts` (whitelist new service names)
**Effort:** 1.5 days
**Diff sketch:**
```ts
// src/lib/llm-router.ts
export async function getLLMClient(companyId: string, role: string): Promise<LLMClient> {
  const override = await getAgentModelOverride(companyId, role); // optional
  const providerKey = override?.provider ?? (await getCompanyDefaultProvider(companyId)) ?? "anthropic";
  const userKey = await getUserApiKey(companyId, providerKey); // existing
  if (providerKey === "anthropic") return makeAnthropic(userKey ?? process.env.ANTHROPIC_API_KEY);
  if (providerKey === "openai") return makeOpenAIShim(userKey);
  if (providerKey === "gemini") return makeGeminiShim(userKey);
  // bedrock / azure / openai_compat: same pattern
}
```
**Scope discipline:** v1 of BYOM = chat path only (no tool-use parity across providers). Tool-use stays Anthropic-only for now; document this in `/admin/integrations/models` UI. *(This is the PRD's "Risk: BYOM tool-use leakier than expected" mitigated by scoping.)*

---

### Gap 7 — Founding-vision blog post live

**Files touched:** `src/app/blog/why-we-are-building-the-autonomous/page.tsx` (new), update internal links in existing blog posts
**Effort:** half-day
**Diff:** Convert `docs/vision/blog-founding-vision.md` to JSX following the exact structure of `src/app/blog/what-are-ai-agents/page.tsx` (Article JSON-LD + Navbar + content). Add internal links to existing posts.

---

### Gap 8 — Production deploy + secrets + commit hygiene

**Why:** TODO.md already captures all of this. Listing it here for completeness so v2 actually ships.

**Tasks:**
- Commit 30+ uncommitted files in 6–8 logical commits (already specced in `TODO.md` §"From you")
- Rotate Supabase / Shopify / Telegram secrets (specced in `TODO.md` §"Security")
- Deploy to Railway with prod Clerk keys
- Register Telegram webhook against prod URL
- Set up Railway cron for `/api/cron/timesheet-reminders`
- Update Clerk allowed origins to include `memory.theautonomous.org` (for future cross-product SSO)

**Effort:** 1 day (mostly user-facing; secrets and deploys are not codey)

---

## 4. What we explicitly do NOT do (anti-rework guarantees)

These items appear in the PRD but **do not need building**, because the existing implementation already satisfies the requirement or because the cost/benefit doesn't justify scope right now:

| Skipped item | Why skip |
|---|---|
| New `knowledge_edges` table + entity tables (persons/conversations/decisions/commitments/artifacts) | Premature schema. The existing vault + lessons + memory + activity_feed already give us the surface we need for v2. Add structured entity tables in v3 when an actual UX demands graph traversal. |
| New `AgentRunner v2` rebuild | Existing `agent-runner.ts` already has beforeRun/afterRun/onError hooks. We only need to *use* them (Gap 2). |
| New CEO orchestrator agent | `mcp/ceo-tools.ts` already implements the orchestrator pattern with delegation, cap, and agent querying. |
| New message bus | `createInterAgentMessage` + `/api/agents/relay` already exist. Only the parser is missing (Gap 3). |
| New BYOM gateway infrastructure | `user_api_keys` + `getUserApiKey` already exist. We only add an LLM router on top (Gap 6). |
| Standalone Memory product as a separate deploy | The Memory waitlist + landing already exist. The full standalone product lives in the sister repo `autonomous-memory`; v2 launch does *not* block on its deploy. Cross-product SSO is a v3 item. |
| New 9 role-agent definitions | All 13+ roles already have system prompts in `prompts.ts`, toolkits in `mcp/registry.ts`, test prompts in `eval-test-suites.ts`. The infrastructure for them runs; what they need to "ship real work" is *connector hookups per customer*, not platform code. |
| New `/admin/billing` page | `/api/billing/{checkout,portal,webhook}` and `db.getCredits/getCreditTransactions` already work. The user-facing surface can stay in the existing `/profile` until a customer complains. |
| New approvals inbox UX | `/admin/approvals/page.tsx` + `approval_callbacks` migration already in place. v2 keeps it as-is. |
| New cron infra | `/api/cron/timesheet-reminders` exists; same pattern for any new cron. |
| New tenant provisioner | Already shipped (migration 004 + `tenant-provisioner.ts` + provisioning page that polls real state). |
| New event-emit infrastructure (`agent.run.completed`) | Out of scope for v2. Use synchronous post-run lesson writes (Gap 2 covers this). |
| New industry-pack creator UI | `agent-templates.ts` is sufficient until customers ask. |

---

## 5. Execution order (5–7 working days)

Ordered so that each step is self-contained and ships behind a green test suite + green tsc.

| Day | Step | Files touched |
|---|---|---|
| **Day 1** | Commit working tree in logical chunks (Gap 8a) + apply landing copy (Gap 1) | 30+ existing files staged + commit · `src/app/page.tsx` · `src/app/memory/page.tsx` |
| **Day 2** | Lessons injection (Gap 2) + `@mention` dispatch (Gap 3) | `src/app/api/chat/route.ts` · `src/app/api/v1/chat/route.ts` · `src/lib/mention-dispatch.ts` (new) · tests |
| **Day 3** | Shared company memory facade (Gap 4) + `/admin/memory` page (Gap 5) | `src/lib/memory.ts` (new) · `src/lib/db.ts` · `src/app/admin/memory/page.tsx` (new) · sidebar + icons |
| **Day 4** | LLM router + BYOM UI (Gap 6) | `src/lib/llm-router.ts` (new) · chat routes · `src/app/admin/integrations/page.tsx` · `/api/user-keys/route.ts` |
| **Day 5** | Founding-vision blog post (Gap 7) + secret rotation + Railway deploy (Gap 8b) | `src/app/blog/why-we-are-building-the-autonomous/page.tsx` (new) · prod env config |
| **Day 6** | Production smoke: register Telegram webhook on prod URL, set up Railway cron, verify the two live demos still work end-to-end against prod | n/a (infra) |
| **Day 7** | Buffer: bug fixes, doc updates, polish | as needed |

**Exit criteria for v2:**
- All 264+ tests pass (target 280+ after Gaps 2–4 add tests)
- `bunx tsc --noEmit` clean
- Lessons demonstrably read by chat path (verifiable by toggling a recent lesson and seeing it influence the next response)
- `@mention` in one agent's response demonstrably enqueues a relay row for the mentioned agent
- `/admin/memory` shows real data for the seeded tenant
- BYOM verified end-to-end with one OpenAI key in a test tenant
- Both demo verticals still work on prod
- Landing pages live with new copy
- Founding-vision blog live

---

## 6. What changes about the PRD

After this transition plan, the PRD remains the **destination document** but its phasing should be read as follows:

| PRD Phase | Status in light of audit |
|---|---|
| Phase 0 — Stabilize | **Becomes Day 1 + Day 5–6 here** |
| Phase 1 — Shared knowledge graph | **Compresses to Gap 4 + 5** (no schema migration needed) |
| Phase 2 — AgentRunner v2 + Lessons | **Compresses to Gap 2** (runner already exists; just wire the read hook) |
| Phase 3 — CEO orchestrator + bus | **Already done** in `mcp/ceo-tools.ts` + `agents-relay`; just adds Gap 3 parser |
| Phase 4 — BYOM gateway | **Compresses to Gap 6** (BYOK infra already exists) |
| Phase 5 — Role agent build-out | **Already done** in `prompts.ts` + `mcp/registry.ts` + `eval-test-suites.ts`; per-customer connector hookups happen post-launch, on demand |
| Phase 6 — Memory product live | **Deferred to v3** (waitlist + landing already exist; standalone deploy is a separate body of work) |
| Phase 7 — Channels | **Already done** (Telegram live, WhatsApp code-complete pending BSP; email-in is v3 enhancement) |
| Phase 8 — Billing | **Already done** (Stripe + credits live); `/admin/billing` UI surface is v3 enhancement |
| Phase 9 — Marketing | **Becomes Gap 1 + 7** |

**Original PRD effort:** ~28 working days
**Transition plan effort:** ~5–7 working days
**Compression ratio:** ~4×

---

## 7. Risks specific to this plan

| Risk | Mitigation |
|---|---|
| Lesson injection (Gap 2) bloats system prompts and hurts response quality | Cap at top-5 lessons by recency × relevance; measure response quality via existing `eval-judge.ts` before/after |
| `@mention` parser (Gap 3) creates feedback loops if Agent A `@mentions` Agent B who `@mentions` Agent A | Reuse `ceo-tools.ts`'s `MAX_DELEGATIONS_PER_QUERY = 10` cap; conversation-scoped delegation counter |
| BYOM router (Gap 6) silently breaks tool-use for non-Anthropic providers | Explicitly document "tool-use is Anthropic-only in v2" in the Models settings UI; gate non-Anthropic providers to chat-only paths |
| Shared memory query (Gap 4) becomes the new latency hotspot | Cache vault search results for 60s per (companyId, query); short-circuit when no vault docs exist (mock-fallback semantics) |
| Working-tree commit (Day 1) introduces a subtle regression because the diff is large | Split into 6–8 logical commits per `TODO.md`; run `bun run test` between each commit |

---

## 8. Open questions (small, scoped — not blockers)

1. **`@mention` for human users.** When an agent `@mentions` `@founder`, do we deliver it via Telegram/WhatsApp/email? *(Recommendation: yes, route through `escalation.ts`'s existing channels — no new code.)*
2. **Cap on cross-agent lesson visibility.** Should Sales see Legal's lessons? *(Recommendation: yes for v2 — that's the shared-brain pitch. Add per-company toggle in v3 if a customer asks.)*
3. **BYOM credit accounting.** When the user supplies their own LLM key, do we still charge platform credits? *(Recommendation: discounted rate — half-credits per prompt when BYOM. Set via env for v2; configurable per-plan in v3.)*

---

## 9. Definition of done (v2 launch, redefined)

- [ ] Working tree committed in logical chunks (Day 1)
- [ ] Landing pages live with new copy (Day 1)
- [ ] Lessons demonstrably influence agent responses (Day 2)
- [ ] `@mention` parser dispatches inter-agent relays in chat (Day 2)
- [ ] `/admin/memory` page surfaces shared company memory (Day 3)
- [ ] BYOM works end-to-end with at least one non-Anthropic provider (Day 4)
- [ ] Founding-vision blog post live (Day 5)
- [ ] Production deploy on Railway with rotated secrets (Day 5)
- [ ] Telegram webhook registered on prod URL + cron live (Day 6)
- [ ] Both demo verticals still work on prod (Day 6)
- [ ] Tests green, `tsc` clean

That's the whole v2.

---

**Awaiting approval to begin Day 1.**
