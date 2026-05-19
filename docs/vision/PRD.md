# PRD — The Autonomous, v2 (AI-Native Operating System)

> **Status:** Draft for approval · **Author:** Abhinav Ramesh · **Date:** 2026-05-12
> **Predecessors:** `CONTEXT.md`, `HANDOFF.md`, `TODO.md`, `docs/vision/{landing-copy,sales-talking-points,blog-founding-vision,investor-onepager}.md`
> **Scope:** Rebuild the platform around the *closed-loop, shared-memory, BYOM* vision. Preserve the two existing demo verticals (Shopify Editor, Telegram Timesheets) as live proof.

---

## 1. Vision

The Autonomous is **the operating system for AI-native companies** — a platform where companies run as closed loops, with a persistent shared memory feeding a coordinated workforce of role agents that share one brain.

Three properties define a v2 tenant:

1. **Queryable** — every artifact (meeting, decision, document, customer signal, agent run) is captured into a tenant-scoped knowledge graph.
2. **Autonomous** — 15 role agents + a CEO orchestrator read from that graph, take real action through real tool integrations, and write lessons back.
3. **Model-agnostic** — Claude Sonnet 4.6 is the default; any OpenAI-compatible model can be plugged in per-tenant or per-agent.

Everything else in this PRD serves those three properties.

---

## 2. Goals & non-goals

### 2.1 In-scope goals (v2)

1. **Unified knowledge graph** across Memory + Agents, with one identity layer (Clerk).
2. **CEO orchestrator** as the front door — receives intents, routes to role agents, surfaces approvals.
3. **9–10 role agents shipping real work** end-to-end (not just the 2 demo verticals).
4. **Memory product live** (transcription → entity extraction → knowledge graph → pre-meeting brief).
5. **BYOM gateway** with per-tenant model selection + per-agent overrides.
6. **Inter-agent collaboration** via `@mentions` and message-bus.
7. **Closed-loop lessons** — every run writes outcomes back; next run reads them.
8. **Multi-channel access** — Web (`/admin`), WhatsApp, Telegram all stay current.
9. **Production-grade deployment** — Railway prod, secrets rotated, cron live.

### 2.2 Out of scope (deferred)

- Mobile native apps (PWA suffices for v2)
- Public marketplace for custom agents / skills
- Voice calls with agents (Memory captures meetings, not phone)
- Multi-region / data residency controls (single Singapore region for v2)
- On-prem deployment
- Fine-tuning UX (you can BYOM a fine-tune; we don't host the fine-tuning loop)
- Per-agent observability dashboards beyond run traces (Langfuse handles the heavy lift)

### 2.3 Non-goals (intentionally won't do)

- Compete with Notion/Linear/Slack as the system of record — we *consume* them
- Become a general-purpose chatbot — every interaction maps to an agent run

---

## 3. Users & personas

| Persona | What they want | Where they live |
|---|---|---|
| **Founder / CEO (SMB, 1–50 people)** | Run the company with a small team; offload 70% of repetitive work | `/admin` overview + CEO agent on WhatsApp |
| **Operations leader (50–500 people)** | Visible workflows, predictable outcomes, low coordination overhead | `/admin` agents + approvals + lessons |
| **Executive (VP+, any size)** | Memory product first — pre-meeting briefs, never forget a commitment | `memory.theautonomous.org` |
| **Function lead (VP Sales, VP Marketing, etc.)** | One role agent that *actually* does the function end-to-end | `/admin/agents/<role>` |
| **Developer / Integrator** | BYOM, custom skills, custom agent definitions | `/admin/integrations` + Agent SDK |

---

## 4. Critical user journeys

### J1 — First-time founder onboarding (≤ 2 minutes)
1. Sign up via Clerk → `/onboarding`
2. Enter company website → AI analyzes → recommends 5 default roles + CEO orchestrator
3. Pick channel preference (Dashboard / WhatsApp / Telegram)
4. Provisioning runs (state machine) → lands on `/admin`
5. CEO agent posts a welcome card with 3 starter actions

### J2 — Sales agent runs a campaign
1. Founder messages CEO agent on WhatsApp: *"Get me 20 demos with FinTech CTOs in NYC."*
2. CEO orchestrator routes → Sales agent receives task
3. Sales agent: queries Memory for ICP context → Apollo.io search → personalized sequences (Instantly.ai) → schedules demos on Calendly
4. Writes back: prospects, sequences, demo bookings → Memory graph + lessons
5. Daily status card to founder; escalation if reply rate < threshold

### J3 — Pre-meeting brief (Memory)
1. Executive's calendar event 30 minutes away
2. Memory cron: pulls upcoming meeting → queries knowledge graph for prior interactions with attendees → Claude synthesizes brief
3. Delivered via email + `/memory` dashboard + (optional) WhatsApp
4. After meeting: record uploaded → transcribed → entities extracted → linked back into graph

### J4 — Inter-agent collaboration
1. Sales agent closes a deal → needs MSA drafted
2. Sales: `@Legal please draft an MSA for Acme Inc, terms: $50k/yr, net-30, standard mutual NDA`
3. Message-bus delivers to Legal agent → Legal queries Memory for prior MSAs + company standard terms → drafts → returns
4. Sales receives back, attaches to deal, sends to customer
5. Both runs logged, both write lessons

### J5 — BYOM swap
1. Tenant admin goes to `/admin/integrations/models`
2. Enters provider (OpenAI / Bedrock / Azure / custom OpenAI-compatible)
3. API key stored encrypted in Vault
4. Sets per-agent overrides ("Strategy agent uses Opus, all others Sonnet")
5. Next agent run uses the configured model; no other changes

### J6 — Closed-loop learning
1. Sales agent run completes with low conversion
2. Run writes lesson: *"FinTech CTOs respond 2x more to '15-min walkthrough' than 'demo' in subject line"*
3. Next Sales run reads recent lessons before composing → applies the pattern
4. Founder sees lessons stream on `/admin/agents/sales`

---

## 5. Functional requirements

### 5.1 Identity & tenancy

- **Clerk** as single identity provider, shared between `theautonomous.org` and `memory.theautonomous.org` (cookie-domain `.theautonomous.org`).
- A `company` row per workspace; users belong to one or more companies via `company_members`.
- All data tenant-scoped via Postgres RLS using `current_company_id()` helper (already exists).
- Workspace switcher in topbar.

### 5.2 Knowledge graph (the shared brain)

The unified store powering both Memory and Agents.

**Entity types** (extending existing Vault):
- `Person` — internal/external contacts
- `Conversation` — meeting, call, email thread, agent run
- `Decision` — durable choices the company has made
- `Commitment` — promises made by/to a Person, deadline-bearing
- `Document` — files, contracts, briefs
- `Event` — calendar events, scheduled triggers
- `Lesson` — what an agent learned from a run
- `Artifact` — outputs produced by agent runs (drafts, lists, reports)

**Storage:**
- Structured rows in Postgres (one table per entity type, RLS-protected)
- Embeddings in pgvector (1024-dim, Cohere `embed-multilingual-v3.0` — existing)
- Edges: a single `knowledge_edges` table (`source_type`, `source_id`, `relation`, `target_type`, `target_id`, `properties JSONB`)

**Query API:** `memory.query({ companyId, types, filter, vectorQuery, k })` → returns ranked entities + edges. Used by every agent before producing output.

### 5.3 Memory product (`memory.theautonomous.org`)

Already 60% scaffolded in `autonomous-memory/apps/rowboat`. v2 work:

- **Recording ingest:** upload UI (web) + email-in alias + Fireflies/Zoom webhooks → S3 → Deepgram → entity extraction
- **Pre-meeting briefs:** cron 30 min before each calendar event; UI to view + edit
- **Search UI:** full-text + semantic, filterable by entity type + date range
- **Graph viewer:** interactive node-link visualisation of a subgraph (e.g., everything around "Acme Inc")
- **Cross-product SSO** with `theautonomous.org`

### 5.4 Agent runtime (`AgentRunner` v2)

Extending the existing `src/lib/agent-runner.ts`:

**New requirements:**
- **Pre-run hook:** load relevant Memory subgraph + recent Lessons into the system prompt
- **Tool-call layer:** tools are typed, schema-validated, and tenant-aware
- **Model selection:** reads per-tenant BYOM config → per-agent override → fallback to Sonnet 4.6
- **Budget enforcement:** tokens, wall-clock, and credit consumption (already partially built)
- **Trace emission:** Langfuse-shaped trace for every run; plus thin local `agent_runs` row for the UI
- **Post-run hook:** writes artifacts + lessons back into the graph; emits `agent.run.completed` event

### 5.5 CEO orchestrator (the front door)

A meta-agent that:
- Receives all unsolicited user input (WhatsApp, Telegram, dashboard chat)
- Classifies intent → routes to the right role agent (or asks clarifying question)
- Manages cross-agent threads (one user request may span 3 agents)
- Surfaces approvals when an agent flags one (`requiresApproval: true`)
- Maintains a "today" view: what's in flight, what shipped, what needs you

UI: `/admin` overview + sticky chat widget.

### 5.6 Role agents (9 priority for v2)

Each has: a definition (system prompt + skills), a tool set, a default trigger (cron or event), an approval policy.

| Role | Tools (real APIs) | Default trigger | Approval gate |
|---|---|---|---|
| **CEO Orchestrator** | All other agents (as tools) | Inbound messages, daily 9am roll-up | n/a |
| **Sales** | Apollo, Instantly, HubSpot, Gmail | Manual + daily prospecting cron | Outbound sequences > N recipients |
| **Marketing** | Web (Exa), Buffer, Resend, internal CMS | Weekly content cron | Public posts |
| **Strategy** | Web research, Exa, Crunchbase, internal docs | Manual (long-running) | Always (judgment-heavy) |
| **Customer Success** | Intercom/Zendesk, Memory queries | Inbound ticket | Plan changes |
| **Legal** | Contract templates, Memory, web | Manual | Always before send |
| **Finance** | Stripe, internal ledger, Slack | Daily cash + weekly model | Cap-table or > $X moves |
| **Admin** | Calendar, Drive, DocuSign | Manual | Sending docs externally |
| **HR** | Greenhouse/Lever, Slack, Memory | Inbound application | Offers, terminations |
| **(Existing) Timesheet vertical** | Telegram, internal DB | Daily cron | n/a (kept as demo) |
| **(Existing) Shopify vertical** | Shopify Admin API | Manual + competitor cron | Apply step |

### 5.7 Inter-agent collaboration

- A `messages` table per company holds the bus
- Agent A can `@mention` Agent B with a structured payload
- The runtime dispatches a new run for Agent B with the payload as initial input + thread context
- Threads are first-class objects in the UI

### 5.8 BYOM gateway

- `/admin/integrations/models` UI + `model_providers` table
- Supports: Anthropic (default), OpenAI, Google Gemini, AWS Bedrock, Azure OpenAI, OpenAI-compatible custom endpoints
- Credentials stored encrypted (existing `ENCRYPTION_KEY` flow)
- Per-tenant default + per-agent override
- Routing layer in `src/lib/llm-router.ts` (new) — normalizes message format across providers

### 5.9 Skills & tools registry

- A skill = a typed tool the runtime exposes to an agent
- Tools live in `src/lib/tools/<vendor>/<tool-name>.ts`, each exporting `{ schema, handler, scopes }`
- An agent definition lists which tools it can call
- Per-tenant integration credentials live in `integrations` table

### 5.10 Approvals & escalations

- Existing `approval_callbacks` + `admin_notifications` (migration 003) is the substrate
- New: `/admin/approvals` becomes the inbox; approvals decay (TTL) and notify via channel
- Escalation logic in `src/lib/escalation.ts` (already exists) — extend to read user comms preferences

### 5.11 Lessons (closed-loop)

- `lessons` table already exists (migration 003)
- New: lesson writer hook in `AgentRunner.afterRun`
- New: lesson reader hook in `AgentRunner.beforeRun` (top-K by relevance to the input)
- Surface lessons stream on each `/admin/agents/<role>` page

### 5.12 Channels

- Web `/admin` (primary)
- WhatsApp via Gupshup BSP (Tier-4 env vars exist; BSP signup blocked)
- Telegram (already live for timesheet vertical; generalize to per-agent inbound)
- Email-in (Resend / Postmark inbound parse → CEO orchestrator)

### 5.13 Billing

- Credits-based (existing model)
- Per-run credit charge derived from token usage × model rate
- Stripe metered billing for overage
- Memory product on flat-tier Stripe subscriptions ($99 / $299 / custom)

### 5.14 Admin surface

Existing `/admin/*` extended:
- `/admin` — overview (CEO digest + live run strip)
- `/admin/agents` — roles grid (existing)
- `/admin/agents/[role]` — runs, lessons, triggers (existing)
- `/admin/agents/[role]/[runId]` — trace (existing)
- `/admin/memory` — *(new)* graph viewer + search inside the agents app
- `/admin/approvals` — (existing)
- `/admin/notifications` — (existing)
- `/admin/vault` — (existing)
- `/admin/integrations` — (existing) — extend with `models` and `channels` sub-tabs
- `/admin/timesheets` — (existing demo vertical)
- `/admin/shopify` — (existing demo vertical)
- `/admin/provisioning` — (existing)
- `/admin/billing` — *(new)* credits, plan, usage

### 5.15 Marketing surface

- `/` — apply approved landing copy (`docs/vision/landing-copy.md` § A)
- `/memory` — apply approved landing copy (§ B)
- `/blog/why-we-are-building-the-autonomous` — convert from markdown
- Existing 3 blog posts kept; minor internal linking refresh

---

## 6. Non-functional requirements

| Dimension | Target |
|---|---|
| **p95 agent run latency (single-tool)** | < 8s |
| **p95 multi-tool agent run** | < 30s |
| **Memory pre-meeting brief generation** | < 15s |
| **Knowledge graph query p95** | < 200ms |
| **Auth gate (Clerk → `/admin`)** | < 1s |
| **Uptime target** | 99.5% (single-region v2; 99.9% on Enterprise) |
| **RLS on every tenant-scoped table** | mandatory |
| **All secrets encrypted at rest** | mandatory (`ENCRYPTION_KEY` AES-256-GCM) |
| **PII minimization** | Memory transcripts auto-redact phone/SSN/credit-card before persistence |
| **Test coverage** | maintain 80%+ on `src/lib/**` |
| **Type-check** | `tsc --noEmit` must stay green |

---

## 7. Technical architecture

```
                   ┌──────────────────────────────────────────────┐
                   │              Clerk (shared SSO)              │
                   └────────┬──────────────────────────┬──────────┘
                            │                          │
                ┌───────────▼─────────────┐    ┌──────▼─────────────┐
                │  theautonomous.org      │    │  memory.theauto…   │
                │  (Agents, Next.js 16)   │    │  (Memory, Next 15) │
                └─────┬───────────────┬───┘    └─────┬──────────────┘
                      │               │              │
                      │     ┌─────────▼──────────────▼──────────┐
                      │     │   Shared Postgres (Supabase)      │
                      │     │   - RLS on every table            │
                      │     │   - pgvector (1024-dim)           │
                      │     │   - knowledge_edges table         │
                      │     └─────────────────┬─────────────────┘
                      │                       │
   ┌──────────────────▼───────────────┐       │
   │  AgentRunner v2                  │       │
   │  - beforeRun: load subgraph +    │       │
   │    recent lessons                │       │
   │  - tool-use loop (typed)         │       │
   │  - LLM router (BYOM)             │       │
   │  - afterRun: write artifacts +   │       │
   │    lessons, emit events          │       │
   └─────┬────────────────────────────┘       │
         │                                    │
   ┌─────▼─────────┐     ┌──────────┐    ┌────▼────────┐
   │  Tools layer  │     │ LLM      │    │ Deepgram +  │
   │  (Apollo,     │     │ router → │    │ Claude      │
   │  Instantly,   │     │ Anthropic│    │ extraction  │
   │  HubSpot,     │     │ OpenAI,  │    │ pipeline    │
   │  Shopify,     │     │ Bedrock, │    └─────────────┘
   │  Telegram,    │     │ custom   │
   │  Gmail …)     │     └──────────┘
   └───────────────┘
```

**Stack:**
- Frontend: Next.js 16 App Router (agents) / Next 15 (memory)
- Backend: Same Next.js — server actions + route handlers
- Runtime: Bun
- DB: Supabase Postgres + pgvector
- Object storage: AWS S3 (Memory audio)
- Queue: Redis (Memory only initially; agents are synchronous v2)
- Models: Anthropic (default), OpenAI/Bedrock/Azure/custom via router
- Embedding: Cohere `embed-multilingual-v3.0`
- Transcription: Deepgram
- Auth: Clerk
- Payments: Stripe
- Deploy: Railway (both products)
- Observability: Langfuse for agent traces; structured app logs

---

## 8. Data model (new + extended)

```sql
-- existing tables: companies, agents, messages, user_profiles, vault_documents,
--   vault_chunks, lessons, admin_notifications, approval_callbacks,
--   provisioning state cols, tally_*, employees, timesheet_submissions,
--   reminder_schedules

-- new tables (v2)
CREATE TABLE knowledge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  relation text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON knowledge_edges (company_id, source_type, source_id);
CREATE INDEX ON knowledge_edges (company_id, target_type, target_id);

CREATE TABLE persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  role text,
  external boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind text NOT NULL, -- 'meeting' | 'call' | 'email_thread' | 'agent_run' | 'chat'
  title text,
  occurred_at timestamptz,
  source text,        -- 'deepgram' | 'gmail' | 'agent' …
  source_ref text,
  transcript text,
  embedding vector(1024),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE decisions (...);     -- similar shape
CREATE TABLE commitments (...);   -- + due_at, status
CREATE TABLE events_log (...);
CREATE TABLE artifacts (...);

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_role text NOT NULL,
  triggered_by text NOT NULL,  -- 'user' | 'cron' | 'event' | '@mention'
  input jsonb NOT NULL,
  output jsonb,
  status text NOT NULL,         -- 'queued' | 'running' | 'completed' | 'failed' | 'awaiting_approval'
  model_used text,
  tokens_in int,
  tokens_out int,
  credits_used int,
  langfuse_trace_id text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE model_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL,       -- 'anthropic' | 'openai' | 'bedrock' | 'azure' | 'custom'
  encrypted_credentials text NOT NULL,
  default_model text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE agent_model_overrides (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_role text NOT NULL,
  provider_id uuid NOT NULL REFERENCES model_providers(id),
  model text NOT NULL,
  PRIMARY KEY (company_id, agent_role)
);

CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vendor text NOT NULL,        -- 'apollo' | 'shopify' | 'telegram' | 'gmail' | …
  status text NOT NULL,         -- 'connected' | 'error' | 'pending'
  encrypted_credentials text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_id, vendor)
);

-- migrations 007–012 cover this in order; see § 10
```

---

## 9. API surface (delta)

All under `/api`, Clerk-gated unless noted.

```
GET    /api/memory/search?q=&types=&from=&to=
POST   /api/memory/ingest                    (recording upload → S3 → pipeline)
GET    /api/memory/brief?eventId=
GET    /api/memory/graph?root=&depth=

POST   /api/agents/run                       (any role; payload: { role, input, threadId? })
GET    /api/agents/runs?role=&status=
GET    /api/agents/runs/:id
POST   /api/agents/runs/:id/approve
POST   /api/agents/runs/:id/reject

POST   /api/models/providers                 (BYOM)
PATCH  /api/models/providers/:id
DELETE /api/models/providers/:id
PUT    /api/models/overrides/:role

POST   /api/integrations/:vendor/connect
DELETE /api/integrations/:vendor

POST   /api/messaging/orchestrate            (CEO orchestrator entrypoint, called by channel webhooks)
```

---

## 10. Phasing & milestones

Each phase is a shippable slice. Each leaves the tree green (264+ tests pass, `tsc --noEmit` clean).

### Phase 0 — Stabilize (2 days)
- Apply approved landing copy to `/` and `/memory`
- Commit the 30+ uncommitted files in 6–8 logical commits (per existing TODO.md)
- Rotate secrets
- Deploy to Railway prod with Telegram webhook + cron

**Exit:** prod traffic possible; demos run live from theautonomous.org

### Phase 1 — Shared knowledge graph (3 days)
- Migration 007: persons, conversations, decisions, commitments, artifacts, knowledge_edges
- `src/lib/memory.ts` — unified query API (extends existing vault.ts)
- Backfill: existing vault docs → conversations rows
- `/admin/memory` page (search + simple list view)

**Exit:** any agent can call `memory.query(...)` and get tenant-scoped results

### Phase 2 — AgentRunner v2 + Lessons closed loop (3 days)
- Extend `agent-runner.ts` with `beforeRun(loadMemorySubgraph + recentLessons)` and `afterRun(writeArtifacts + writeLessons)`
- Migration 008: `agent_runs` table
- Run trace UI reads real rows (no more mock)
- Lessons stream on each role page

**Exit:** running an agent reads relevant memory and writes lessons that the next run sees

### Phase 3 — CEO orchestrator + message bus (3 days)
- New agent definition: CEO orchestrator with role-routing
- `messages` table extension for threads
- `/api/messaging/orchestrate` endpoint
- `@mention` parsing + dispatch
- Sticky chat widget on `/admin`

**Exit:** sending "find me 20 FinTech CTOs" routes to Sales agent, returns to CEO thread

### Phase 4 — BYOM gateway (2 days)
- Migration 009: `model_providers`, `agent_model_overrides`
- `src/lib/llm-router.ts` — provider-agnostic chat completion + tool-use
- `/admin/integrations/models` UI
- Per-agent override picker

**Exit:** swap Anthropic → OpenAI for one tenant, agents continue to work

### Phase 5 — Role agent build-out (6 days, parallelizable)
For each of the 7 priority roles (Sales, Marketing, Strategy, Customer Success, Legal, Finance, Admin):
- Agent definition (system prompt + skill list)
- Tool implementations (Apollo, Instantly, HubSpot, Stripe, etc.) — only the must-have ones for v2
- Default trigger (cron or event)
- Smoke test against a real account or sandbox

**Exit:** each role agent can complete one canonical workflow end-to-end

### Phase 6 — Memory product live (4 days)
- Provision MongoDB / Redis / Deepgram / S3 / Stripe creds
- Deploy `autonomous-memory` to Railway behind `memory.theautonomous.org`
- Cross-product SSO (Clerk shared)
- Recording upload UI + pipeline live
- Pre-meeting brief cron
- Search + graph viewer

**Exit:** an executive can upload a recording, see entities extracted, and get a brief for tomorrow's meeting

### Phase 7 — Multi-channel + email-in (2 days)
- Gupshup BSP signup (blocked on Meta — start in parallel)
- Email-in via Resend/Postmark inbound parse
- Channel-routing in CEO orchestrator

**Exit:** founder can email or WhatsApp the CEO orchestrator and get a response

### Phase 8 — Billing + production hardening (2 days)
- Credits accounting on every run
- Stripe metered billing
- `/admin/billing` page
- Error budgets, alerting, basic SLO dashboard

**Exit:** customers can sign up, get free credits, hit limit, upgrade

### Phase 9 — Marketing surface (1 day)
- Convert founding-vision blog post to JSX
- Add internal links across existing posts
- Update OG images

**Exit:** marketing site reflects v2 vision; blog post live

**Total: ~28 working days of focused build.** Realistic calendar with normal interruptions: 6–8 weeks.

---

## 11. Success metrics

### Product
- **Activation:** signups completing onboarding within 5 min — target 70%
- **Active workforce:** companies with ≥3 agent runs / week — target 50% of paying tenants
- **Closed-loop signal:** % of agent runs that read a prior lesson — target 60%
- **Cross-product:** % of Agents tenants that try Memory in first 30 days — target 25%

### Business
- **Free → Growth conversion:** target 8%
- **Memory paid conversion (from waitlist):** target 30%
- **Net revenue retention:** target 115% at 12 months

### Engineering
- **Test coverage maintained:** ≥ 80% on `src/lib/**`
- **tsc clean:** mandatory before every merge
- **p95 agent run < 30s** (multi-tool)
- **Zero RLS bypass incidents**

---

## 12. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gupshup BSP approval slips → WhatsApp delayed | High | Email-in + Telegram cover the channel surface for v2; WhatsApp is upside |
| BYOM model normalization is leakier than expected (tools differ across providers) | High | v2 supports tool-use only for providers with native tool-use APIs; others are chat-only with structured-output fallback |
| Memory pipeline cost (Deepgram + Claude extraction) eats margin | Medium | Tier-gated: Early Access = 5 hrs/mo, Executive = 20 hrs/mo, overage billed |
| Agent runs producing hallucinated tool calls | Medium | Schema-validated tools; runtime rejects malformed calls before dispatch |
| Cross-product SSO friction (cookie-domain, dev keys) | Medium | Use `.theautonomous.org` cookie domain; gate Clerk dev keys behind feature flag |
| RLS regression from migration churn | Low (we have tests) | Add an explicit RLS test pass to CI; any new table without RLS fails build |
| Vendor lock-in on Anthropic | Low | BYOM is built in from Phase 4 |

---

## 13. Open questions (for the founder)

1. **Memory product positioning during v2 launch.** Soft-launch with the same audience as Agents, or hold for a separate executive cohort waitlist?
2. **Default role set on onboarding.** Always recommend the same 5 roles (Sales, Marketing, CS, Finance, Admin), or have the AI pick based on the company website?
3. **WhatsApp via Gupshup.** Start the BSP signup now (1–3 day Meta lead) or skip to email-in for v2?
4. **Pricing of credits per role.** Do high-judgment roles (Legal, Strategy) consume more credits per run, or flat-rate across all roles?
5. **CEO orchestrator scope.** Does it ever take actions itself, or strictly route + summarize? (Recommend strictly route for v2.)
6. **Open-source the Agent SDK?** Could turn into a developer wedge; also a support cost.

---

## 14. What stays untouched from v1

- Two existing demo verticals (`/admin/shopify`, `/admin/timesheets`) — kept verbatim as live proof
- `proxy.ts` Clerk gate
- Tenant-context AsyncLocalStorage
- Vault module (extended, not replaced)
- Tenant provisioner state machine
- DESIGN.md tokens (Instrument Serif + DM Sans + JetBrains Mono)
- Hand-rolled SVG icons + CSS keyframes (no new dependencies casually)
- Mock-fallback pattern for admin pages without DATABASE_URL

---

## 15. Definition of done (v2 launch)

- [ ] All 9 phases complete; tests green; tsc clean
- [ ] Both products deployed to prod (`theautonomous.org` + `memory.theautonomous.org`)
- [ ] Cross-product SSO verified
- [ ] At least 7 role agents shipping real work end-to-end
- [ ] BYOM verified with at least 2 non-Anthropic providers
- [ ] One end-to-end demo: "Enter website → workforce spawned → CEO agent runs a Sales campaign → Memory captures meeting → Legal drafts MSA → all visible in one thread"
- [ ] Founding vision blog post live
- [ ] Landing pages reflect v2 copy
- [ ] Secrets rotated, RLS audited, no `console.log` of PII
- [ ] Three external testers complete a full workflow without help

---

**Awaiting approval to begin Phase 0.**
