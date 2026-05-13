# newvision branch — Status & TODO

> **Last updated:** 2026-05-13 · **Branch:** `newvision` · **HEAD:** `007637e`
> **Tests:** 339/339 passing · **tsc:** clean · **29 commits past `main`**
> **Tier 2 done + 9 of 11 Tier 3 slices shipped.** Remaining items are infra (you-action) or one large slice (per-bot Telegram inbound).
> **GitHub:** https://github.com/matterhornso/theautonomousorg/tree/newvision · **Pair with** `docs/vision/NEWVISION-CONTEXT.md` for the full session context.
>
> Pair this with `docs/vision/TRANSITION-PLAN.md` (the plan) and `docs/vision/PRD.md` (the destination). This file tracks **what's actually on the branch** and **what's next**.

---

## 🟢 What's done on `newvision`

### Phase 0 — housekeeping (8 commits)

| Commit | What |
|---|---|
| `d45e834` | Backend infra: tenant ALS + lessons + escalation + agent runner + WhatsApp/Tally/provisioning routes |
| `f12c793` | Horizontal admin shell + onboarding-to-admin flow + workspace rename |
| `ddb6ed0` | Base schema bootstrap script + migrations 005 (timesheets) + 006 (reminder schedule) |
| `9df53a9` | Telegram timesheet vertical — DB + cron + webhook + admin UI (live-verified with `@timesheettrial_bot`) |
| `7cf0d40` | Shopify editor vertical — planner + apply + insights (live-verified vs `zizrev-ej.myshopify.com`) |
| `559bf9c` | Toast + send-burst + admin animations |
| `11a13db` | Dev: disable PWA on localhost + filter browser-extension errors |
| `734eadb` | Docs: HANDOFF + full v2 vision pack (PRD, transition plan, landing copy, blog, sales, investor) |

### Gaps 1–7 (the actual v2 delta, 7 commits)

| Gap | Commit | What |
|---|---|---|
| 1. Landing copy | `a8475a6` | `/` and `/memory` hero + sections reframed around closed loops / shared brain / BYOM. Text-only edits, structure preserved. |
| 2. Lessons in chat | `19f6e4f` | Both `/api/chat` and `/api/v1/chat` read top-5 lessons via `LessonsHelper.readRecent` before composing the system prompt. Try/catch wrapped. |
| 3. `@mention` parser | `7b45271` | New `src/lib/mention-dispatch.ts` with role-whitelist regex + `INTERNAL_SECRET` header (fixes a real bug where the inline parser was 401'ing). 13 tests. |
| 4. Shared memory facade | `0b32e85` | New `src/lib/memory.ts` — `queryCompanyMemory()` + `summarizeCompanyMemory()` over the 4 existing sources. No schema change. 9 tests. |
| 5. `/admin/memory` page | `9c162c7` | New nav entry + `BrainIcon` + search + type-filter chips + result list. Reuses existing primitives. |
| 6. BYOM router | `8439be3` | New `src/lib/llm-router.ts` — anthropic / openai / openai_compat via the existing `user_api_keys` table. `/api/v1/chat` routes through it. `/admin/integrations` gets a Models section. 7 tests. |
| 7. Founding-vision blog | `03f1977` | `/blog/why-we-are-building-the-autonomous` with full JSON-LD + related-reading cards. |

### Part B — polish pass (1 commit)

| Commit | What |
|---|---|
| `a3b091d` | **Mobile drawer for sidebar** — `/admin/*` was unusable below 1024px. Added `MenuIcon`, `isMobileOpen` state with auto-close on route change, floating hamburger + backdrop + in-drawer close button. Topbar gets `pl-16` on mobile so the breadcrumb clears the hamburger. Desktop behavior unchanged. |

### Part C — v3 prep (1 commit)

| Commit | What |
|---|---|
| `d360ca3` | **Knowledge graph + agent runs index.** Migrations 007 (persons, conversations, decisions, commitments, events_log, artifacts, knowledge_edges — all RLS-protected, conversations has `vector(1024)` + HNSW) and 008 (agent_runs). New `src/lib/knowledge-graph.ts` typed surface with insert + read helpers; all return `null`/`[]` without `DATABASE_URL`. `src/lib/memory.ts` extended with a new `"graph"` `MemoryHitType` that folds the 4 entity types into `queryCompanyMemory`. `/admin/memory` gets a Graph filter chip. 14 new tests. |

**Net since `74b2e50` (main HEAD):** 18 commits · ~120 files · 308 tests (was 264).

---

## ⏳ What's NOT done — work ahead

Organized so the next agent (or you) can pick up at any tier.

### 🔴 Tier 1 — blocks production (you-action)

These need real auth/secrets/access; the agent can't do them unattended.

- [ ] **Rotate secrets** (see `TODO.md` § Security): Supabase DB password, Shopify API secret, Telegram bot token
- [ ] **Open PR** `newvision → main` when ready (URL: https://github.com/matterhornso/theautonomousorg/compare/main...newvision)
- [ ] **Deploy `theautonomous.org` to Railway** — paste `.env.example` keys, swap Clerk to `pk_live_…` / `sk_live_…`, set `NEXT_PUBLIC_APP_URL` + `APP_BASE_URL` to `https://theautonomous.org`
- [ ] **Register Telegram webhook against prod URL** — curl in `TODO.md`
- [ ] **Set up Railway cron** — `30 11 * * *` UTC (= 17:00 IST) hitting `/api/cron/timesheet-reminders?token=$CRON_SECRET`
- [ ] **Apply migrations 007 + 008** to Supabase: `psql $DATABASE_URL -f migrations/007_knowledge_graph.sql && psql $DATABASE_URL -f migrations/008_agent_runs.sql`
- [ ] **Smoke-check the dev server in a browser** with a signed-in Clerk session — the agent could only validate via curl + auth-gate redirects:
  - [ ] `/admin/memory` renders with empty state, type-filter chips work
  - [ ] `/admin/integrations` Models section shows active provider + endpoint
  - [ ] Send `@Sales` from any agent in chat — confirm a row appears in `inter_agent_messages`
  - [ ] Confirm sidebar hamburger works on a phone-size viewport

### ✅ Tier 2 — all 6 slices shipped (2026-05-13)

All of Tier 2 from the original TODO is now on `newvision`. The "minimum
v2 alignment" line in the previous status note is no longer the ceiling —
the closed loop closes on its own, real run data flows into the admin
surface, CEO orchestration works on every inbound channel, BYOM and
billing are wired.

1. ✅ **Wired `agent_runs` writes into chat completions.** Commit `595bd02`.
   `/api/chat` (streaming) + `/api/v1/chat` (non-streaming) open a run
   row, close it with output + usage + model + provider, mark failures
   as `failed` instead of leaving them hanging. New `src/lib/agent-runs.ts`
   module with create/complete/get helpers (6 new tests).
2. ✅ **Flipped `/admin/agents/[role]` + `[runId]` to real data.** Commit `595bd02`.
   Tries `loadAgentRunsByRole` / `loadAgentRun` first; falls back to mock
   when the table is empty. Mapper handles status/triggeredBy translation.
3. ✅ **Lessons-write after every chat completion.** Commit `595bd02`.
   Both chat routes write a lesson with `outputAccepted='unknown'` after
   the assistant turn lands. Future approve/reject UX flips it to
   approved/rejected/modified.
4. ✅ **CEO orchestrator on Telegram + email-in.** Commits `68e5561`, `9fc5102`.
   Inbound messages without an explicit `@RoleName` prefer the CEO agent
   (when present) and use ceoTools with a single tool-use iteration so
   the CEO can `delegate_task` / `query_all_agents`. Telegram-style
   webhook timeout bounded.
5. ✅ **`/admin/billing` page.** Commit `8f6d90a`.
   Balance + used + plan pill + Stripe state · CREDIT_PACKS top-up grid ·
   3-plan card (Starter/Growth/Enterprise) with Stripe checkout buttons ·
   recent transactions list with EmptyState fallback. New BillingIcon
   + sidebar nav entry.
6. ✅ **Email-in via Resend inbound parse.** Commit `9fc5102`.
   `/api/messaging/email` accepts the inbound webhook (HMAC verification
   via `RESEND_INBOUND_SECRET`), strips HTML + quoted reply chains,
   resolves sender → tenant via `messaging_users` then `user_profiles`,
   routes through CEO orchestrator, writes runs + lessons, replies via
   `sendEmail()`. Cold inbound from unknown addresses gets a signup
   nudge instead of a 500. New `sendEmail()` helper in `src/lib/email.ts`.

### ✅ Tier 3 — 7 slices shipped (2026-05-13 cont.)

7 more slices landed since the Tier 2 milestone:

- ✅ **Inter-agent feedback loop** (`bc941f6`). New POST
  `/api/agents/runs/[runId]/feedback` flips a run's lesson from
  `outputAccepted='unknown'` to approved/rejected/modified. Relay route
  now writes its own agent_runs row + lesson for the target agent so
  cross-agent learning compounds. New `updateLessonForRun` in lessons.ts.
- ✅ **Webhook auto-registration on deploy** (`10749a5`). New
  `/api/admin/register-webhooks` endpoint (POST to register, GET to
  introspect). Wire into your CI deploy hook; removes one Tier 1
  you-action permanently. Internal-secret or Clerk auth.
- ✅ **Streaming `/api/chat` BYOM** (`03b5d23`). Dashboard chat now resolves
  the tenant's LLM config and routes non-tool turns through the router.
  Tool-use turns (Apollo / CEO) stay Anthropic. Initial SSE message
  includes `{ provider, model, byom }` for client correlation.
- ✅ **Per-tenant Telegram bot tokens** (`ede73fc`). `telegram.ts` reads
  `user_api_keys` with service `telegram_bot_token` (env fallback). New
  `sendMessageForCompany` / `setWebhookForCompany` / `isTelegramBYOK`
  helpers. Telegram inbound replies use the per-tenant bot when present.
- ✅ **Per-tenant Shopify credentials** (`af84f23`). `loadShopifyConfigForCompany`
  reads `shopify_credentials` from `user_api_keys` (JSON blob with
  storeDomain + clientId + clientSecret). `/api/shopify/{plan,apply,insights}`
  pass it through.
- ✅ **Entity extractor pipeline** (`28bf2d9`). `src/lib/entity-extractor.ts`
  with `ingestConversation` — persists a conversation row, calls Claude
  with a single forced `extract_entities` tool, writes persons + decisions
  + commitments, links everything via `knowledge_edges`. POST
  `/api/memory/ingest` is the writer endpoint. Closes the "v3 schema in
  place but unwritten" gap.
- ✅ **Deepgram audio + pre-meeting brief** (`6e42b65`). `src/lib/deepgram.ts`
  transcribes audio URLs or buffers. POST `/api/memory/ingest/audio`
  chains Deepgram → entity-extractor. `src/lib/brief.ts` synthesises
  pre-meeting briefs over the populated graph (Claude path + deterministic
  fallback). POST `/api/memory/brief` is the endpoint. Tests cover both
  the parser preferences and the relevance filter.

### ✅ Tier 3 — 2 more slices shipped post-milestone

- ✅ **Vault re-embed UI** (`007c37e`). `POST /api/vault/reembed` +
  interactive `ReembedButton` (plain click = `mode=missing`, shift-click
  = `mode=all`). New `reembedAllForCompany` helper iterates chunks,
  re-runs the embedding provider, UPDATEs each row. Toast + page refresh.
- ✅ **Calendar ingester + pre-meeting brief CRON** (`007637e`). Two
  endpoints close the brief loop end-to-end:
  - `POST /api/calendar/ingest` writes `events_log` (idempotent on
    `source` + `sourceRef` — Google Calendar / Outlook / Fireflies /
    manual all OK). Accepts batch or single-event shorthand.
  - `GET|POST /api/cron/pre-meeting-briefs?token=$CRON_SECRET` scans
    `events_log` across tenants in [now+lookAhead-window, now+lookAhead+
    window] (default 30 min ± 10 min), generates a brief, emails the
    first attendee, stamps `metadata.brief_sent_at` for idempotency.
    Tuneable via query params; `?dryRun=1` for testing.
  - New helpers in knowledge-graph.ts: `createEventLog` (with idempotent
    upsert), `updateEventMetadata`, `getEventsAcrossTenantsBetween`.

### 🟡 Tier 3 remaining

- [ ] **Per-bot Telegram webhook paths** — `/api/messaging/telegram/[botSlug]/route.ts`
  so a second tenant doesn't share `@timesheettrial_bot`'s inbound. The
  outbound side already supports per-tenant tokens (see `ede73fc`); just
  need the inbound routing. ~1 day.

### 🔵 Tier 3 — genuinely blocked on external setup

- [ ] **Memory product standalone deploy** (`memory.theautonomous.org`) —
  code in sister repo `autonomous-memory`; needs MongoDB / Redis / S3 /
  Stripe creds + Clerk shared keys on `.theautonomous.org` cookie domain.
  Note: the entity-extractor + Deepgram + brief pipelines built above
  cover most of the v3 promise inside `theautonomousorg` itself, so the
  sister repo is now optional rather than load-bearing.

### 🔵 Tier 4 — explicit non-goals for v2 (do not do)

Per `TRANSITION-PLAN.md` § "What we explicitly do NOT do":

- Do **not** rebuild the AgentRunner — it already has the hooks
- Do **not** build new CEO orchestrator infrastructure — `mcp/ceo-tools.ts` already implements delegation with anti-runaway cap
- Do **not** rebuild the message bus — `createInterAgentMessage` + `/api/agents/relay` already exist
- Do **not** add a new approvals inbox UX — keep `/admin/approvals/page.tsx` as-is
- Do **not** open-source the Agent SDK (v2 decision; revisit later)

---

## 🧪 Verification checklist (the DoD for v2 + the new Tier-2 layer)

- [x] Working tree committed in logical chunks
- [x] Landing pages live with new copy
- [x] Lessons read into the system prompt on every chat (code path)
- [x] Lessons **written** after every chat completion (closed loop closes)
- [x] `@mention` parser dispatches inter-agent relays in chat
- [x] `/admin/memory` page surfaces shared company memory
- [x] BYOM works end-to-end with at least one non-Anthropic provider
- [x] Founding-vision blog post live
- [x] Mobile drawer for `/admin/*` (works on phone/tablet)
- [x] v3 schema in place (migrations 007–008) + typed surface (`knowledge-graph.ts`, `agent-runs.ts`)
- [x] `agent_runs` populated automatically from chat completions
- [x] `/admin/agents/[role]` + `[runId]` read real data (mock fallback)
- [x] CEO orchestrator routes inbound Telegram + email through `delegate_task`
- [x] `/admin/billing` shows credits + plan + Stripe top-ups
- [x] Email-in webhook live (`/api/messaging/email`)
- [x] Inter-agent feedback loop — runs from relays + feedback endpoint flip lessons
- [x] Streaming `/api/chat` honors BYOM (non-tool turns)
- [x] Per-tenant Telegram bot tokens — `user_api_keys` + `sendMessageForCompany`
- [x] Per-tenant Shopify creds — `loadShopifyConfigForCompany` wired into all routes
- [x] Entity extractor — `POST /api/memory/ingest` writes persons/decisions/commitments/edges
- [x] Audio capture — `POST /api/memory/ingest/audio` chains Deepgram → extractor
- [x] Pre-meeting brief generator — `POST /api/memory/brief` with Claude + deterministic fallback
- [x] Webhook self-registration — `POST /api/admin/register-webhooks`
- [x] Vault re-embed UI — wired button + `POST /api/vault/reembed`
- [x] Calendar ingester — `POST /api/calendar/ingest` writes `events_log`
- [x] Pre-meeting brief CRON — `GET|POST /api/cron/pre-meeting-briefs`
- [x] Tests green (339/339), `tsc` clean
- [ ] Production deploy on Railway with rotated secrets
- [ ] Telegram webhook registered on prod URL + cron live
- [ ] Migrations 007 + 008 applied to Supabase
- [ ] Both demo verticals still work on prod
- [ ] Browser smoke-check with signed-in Clerk session

**27 of 32 done.** Remaining 5 are still the same Tier 1 infra you-actions (Railway deploy + secrets, migrations apply, webhook + cron registration, browser smoke-check).

---

## 🗺 File map (anchors for the next agent)

### New on `newvision` (delta vs `main`)
```
docs/vision/
  PRD.md, TRANSITION-PLAN.md, NEWVISION-TODO.md (this file)
  landing-copy.md, sales-talking-points.md, investor-onepager.md
  blog-founding-vision.md
HANDOFF.md
migrations/
  003_lessons.sql, 004_tenant_provisioning.sql
  005_timesheets.sql, 006_reminder_schedule.sql
  007_knowledge_graph.sql, 008_agent_runs.sql   ← v3 prep (additive)
src/lib/
  agent-runner.ts, escalation.ts, lessons.ts
  tenant-context.ts (M), vault.ts (M), vault-extractors.ts
  tenant-provisioner.ts
  timesheets.ts, reminder-schedule.ts
  shopify.ts, shopify-planner.ts, shopify-apply.ts, shopify-insights.ts
  mention-dispatch.ts    ← Gap 3
  memory.ts              ← Gap 4 + Part C extension
  llm-router.ts          ← Gap 6
  knowledge-graph.ts     ← Part C
src/app/admin/
  _components/{sidebar,topbar}.tsx (M for mobile drawer + brain icon)
  _components/{toast,send-burst,icons,primitives}.tsx
  _components/icons.tsx (M — BrainIcon + MenuIcon)
  layout.tsx, page.tsx, agents/*, approvals/, notifications/, vault/,
  integrations/page.tsx (M — Models section)
  provisioning/, shopify/, timesheets/
  memory/page.tsx        ← Gap 5
src/app/api/
  agents/relay/route.ts (existing — used by mention-dispatch)
  chat/route.ts (M — lessons + tightened mention parser)
  v1/chat/route.ts (M — lessons + dispatchMentions + llm-router)
  companies/, cron/, integrations/tally/, messaging/whatsapp/
  provisioning/, shopify/, timesheets/
src/app/blog/
  why-we-are-building-the-autonomous/page.tsx
test/
  agent-runner.test.ts, escalation.test.ts, lessons.test.ts
  vault-extractors.test.ts, tenant-provisioner.test.ts
  whatsapp-routes.test.ts, tally-ingest.test.ts
  shopify.test.ts, timesheets.test.ts
  mention-dispatch.test.ts (13)
  memory.test.ts (9)
  llm-router.test.ts (7)
  knowledge-graph.test.ts (14)
```

### Useful entry points for the next agent

| Task | Start here |
|---|---|
| Add a new role agent | `src/lib/prompts.ts` (system prompt) + `src/lib/mcp/registry.ts` (tools) + `src/lib/eval-test-suites.ts` (smoke prompts) |
| Wire AgentRunner to write to agent_runs | `src/lib/agent-runner.ts` § afterRun + add `createAgentRun` in `src/lib/db-postgres.ts` |
| Add another LLM provider to BYOM | `src/lib/llm-router.ts` § `runOpenAICompatible` (gemini, bedrock, azure) |
| Stream the BYOM chat | `src/app/api/chat/route.ts` — currently only the v1 (non-streaming) goes through the router |
| Make the graph populate | `src/lib/knowledge-graph.ts` `create*` helpers, called from Memory ingestion pipeline |
| Add a new admin page | Model on `src/app/admin/memory/page.tsx` (server component + primitives + resolveTenant) |

---

## ⚙️ Operational commands

```bash
# Run all tests
bun run test

# Type-check
bunx tsc --noEmit

# Dev server (port 3007 by convention)
PORT=3007 bun run dev

# Apply v3 migrations to a remote Supabase
psql "$DATABASE_URL" -f migrations/007_knowledge_graph.sql
psql "$DATABASE_URL" -f migrations/008_agent_runs.sql

# Push the branch
git push origin newvision

# Open PR (when ready)
gh pr create --base main --head newvision \
  --title "v2: AI-native operating system — closed loops, shared brain, BYOM" \
  --body-file docs/vision/TRANSITION-PLAN.md
```

---

**Next session, the cleanest first move is Tier 2 item 1** — wire `AgentRunner.afterRun` to write to `agent_runs` + `artifacts`. That turns the v3 tables from "ready" to "populated" and unblocks the rest of Tier 2.
