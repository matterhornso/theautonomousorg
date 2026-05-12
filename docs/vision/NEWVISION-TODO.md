# newvision branch — Status & TODO

> **Last updated:** 2026-05-12 · **Branch:** `newvision` · **HEAD:** `d360ca3`
> **Tests:** 308/308 passing · **tsc:** clean
> **GitHub:** https://github.com/matterhornso/theautonomousorg/tree/newvision
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

### 🟡 Tier 2 — next coding slices (agent can do these unattended)

Recommended order. Each is self-contained and ships behind green tests + green tsc.

1. **Wire `AgentRunner.afterRun` to write to `agent_runs` + `artifacts`.**
   - Makes the v3 tables non-empty so `/admin/memory` Graph chip shows real data
   - Replaces the mock fixtures in `/admin/agents/[role]/[runId]`
   - Files: `src/lib/agent-runner.ts`, `src/lib/db-postgres.ts` (add `createAgentRun` + `completeAgentRun`)
   - Estimate: ½ day
2. **Flip `/admin/agents` from mock to real `agent_runs` rows.**
   - Files: `src/app/admin/agents/[role]/page.tsx`, `[role]/[runId]/page.tsx`, `_lib/admin-data.ts`
   - Keep mock fallback when the table is empty
   - Estimate: ½ day
3. **Stream lessons-write on chat completion.**
   - After the assistant turn lands in `/api/chat`, write a lesson with `outputAccepted: "unknown"` (user can override later via an approve/reject UI)
   - Files: `src/app/api/chat/route.ts`, `src/app/api/v1/chat/route.ts`
   - Closes the closed loop end-to-end
   - Estimate: ½ day
4. **CEO orchestrator on inbound channels.**
   - WhatsApp + Telegram webhooks already exist; route ALL inbound (not just `/link`-style keywords) through the CEO agent via `executeCeoTool` so it can `delegate_task` to the right role
   - Files: `src/app/api/messaging/telegram/route.ts`, `src/app/api/messaging/whatsapp/webhook/route.ts`
   - Estimate: 1 day
5. **`/admin/billing` page.**
   - Reads `getCredits` + `getCreditTransactions` + Stripe subscription
   - Files: `src/app/admin/billing/page.tsx` (new), sidebar nav entry
   - Estimate: ½ day
6. **Email-in (Resend inbound parse) → CEO orchestrator.**
   - The cheap-and-cheerful alternative to WhatsApp (which is blocked on Gupshup BSP)
   - Files: `src/app/api/messaging/email/route.ts` (new)
   - Estimate: 1 day

### 🟢 Tier 3 — v3.1+ (real product work, larger slices)

- [ ] **Memory product standalone deploy** (`memory.theautonomous.org`) — code in sister repo `autonomous-memory`; needs MongoDB / Redis / Deepgram / S3 / Stripe creds + Clerk shared keys on `.theautonomous.org` cookie domain
- [ ] **Deepgram + Claude entity-extraction pipeline** — the actual writer that fills `persons` / `conversations` / `decisions` / `commitments` from uploaded recordings
- [ ] **Pre-meeting brief cron** — 30 min before each `events_log` event, query the graph, synthesize via Claude, deliver via existing `debrief.ts` channel chain (Telegram → Email → Dashboard)
- [ ] **Inter-agent feedback loop** — when human approves/rejects a relay response, write a `lesson` for the target agent so cross-agent learning compounds (today only direct chat lessons write)
- [ ] **Per-tenant Telegram bot tokens** — current code uses one global `@timesheettrial_bot`; move to `integrations` table per-firm
- [ ] **Per-tenant Shopify credentials** — same comment; `SHOPIFY_CLIENT_ID/SECRET` are global env right now
- [ ] **Vault re-ingest UI** — the existing Vault page has a `Re-embed` button that doesn't do anything yet
- [ ] **Streaming `/api/chat` BYOM** — today only `/api/v1/chat` (non-streaming) routes through the LLM router; the streaming dashboard chat stays Anthropic-only. Add OpenAI streaming for parity.
- [ ] **Webhook auto-registration on deploy** — `src/lib/telegram.ts:setWebhook` already exists; wire it into a deploy hook so prod webhook registers automatically

### 🔵 Tier 4 — explicit non-goals for v2 (do not do)

Per `TRANSITION-PLAN.md` § "What we explicitly do NOT do":

- Do **not** rebuild the AgentRunner — it already has the hooks
- Do **not** build new CEO orchestrator infrastructure — `mcp/ceo-tools.ts` already implements delegation with anti-runaway cap
- Do **not** rebuild the message bus — `createInterAgentMessage` + `/api/agents/relay` already exist
- Do **not** add a new approvals inbox UX — keep `/admin/approvals/page.tsx` as-is
- Do **not** open-source the Agent SDK (v2 decision; revisit later)

---

## 🧪 Verification checklist (the DoD for v2)

From `TRANSITION-PLAN.md` § 9, with current status:

- [x] Working tree committed in logical chunks (Day 1)
- [x] Landing pages live with new copy
- [x] Lessons demonstrably influence agent responses (code-side; needs browser confirm)
- [x] `@mention` parser dispatches inter-agent relays in chat
- [x] `/admin/memory` page surfaces shared company memory
- [x] BYOM works end-to-end with at least one non-Anthropic provider (verified via `test/llm-router.test.ts`)
- [x] Founding-vision blog post live (renders 200 at `/blog/why-we-are-building-the-autonomous`)
- [ ] Production deploy on Railway with rotated secrets
- [ ] Telegram webhook registered on prod URL + cron live
- [ ] Both demo verticals still work on prod
- [x] Tests green (308/308), `tsc` clean

**v2 DoD: 9 of 11 done.** Last two are infra you-actions in Tier 1 above.

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
