# newvision branch — Session Context

> **Read this if you're a new Claude session picking up the `newvision` branch.** It captures the full session from 2026-05-11 to 2026-05-13: what was found, what was decided, every commit, the file map, and where to start. Pair with `NEWVISION-TODO.md` (the open work) and `TRANSITION-PLAN.md` (the strategy).
>
> **Branch:** `newvision` · **HEAD:** `007637e` · **Net since `main`:** 29 commits · **Tests:** 339/339 · `tsc`: clean
> **PR:** https://github.com/matterhornso/theautonomousorg/compare/main...newvision (not opened yet — see Tier 1 below)

---

## Session intent

User asked to:
1. Re-frame the platform vision around the YC "AI-native company" thesis (closed loops, shared brain, BYOM, autonomous workforce).
2. Audit the existing codebase against a fresh PRD without rebuilding what already works.
3. Build everything on a side branch (`newvision`); do not merge to `main`.

The audit was the critical move. The original PRD prescribed 28 working days of net-new building. The audit revealed ~80% of v2 was already in code under different names (CEO orchestrator in `mcp/ceo-tools.ts`, message bus via `createInterAgentMessage` + `/api/agents/relay`, daily cross-agent sync in `chai-time.ts`, BYOK in `user_api_keys`, etc.). The transition plan compressed the original PRD into 8 surgical gaps + tiered follow-ups. Everything since has been executing that compressed plan and extending past it.

---

## The four reference documents

| File | What it is |
|---|---|
| `docs/vision/PRD.md` | The destination — 9-phase v2 PRD. Read for the "why." |
| `docs/vision/TRANSITION-PLAN.md` | The plan — audit-grounded delta of what actually needed building. Read for the "how." |
| `docs/vision/NEWVISION-TODO.md` | What's done + what's open. Read first when picking up the branch. |
| `docs/vision/NEWVISION-CONTEXT.md` | This file — session narrative + commit map. |

Plus three marketing/sales docs from the same session: `landing-copy.md`, `sales-talking-points.md`, `blog-founding-vision.md`, `investor-onepager.md`.

---

## Commit map — 29 commits past `main` (`74b2e50`)

Grouped by phase. Each line: `<hash> <one-liner>`.

### Phase 0 — housekeeping (8 commits)
- `d45e834` backend infra: tenant ALS + lessons + escalation + agent runner + WhatsApp/Tally/provisioning
- `f12c793` horizontal admin shell + onboarding-to-admin flow
- `ddb6ed0` base schema bootstrap + migrations 005 (timesheets) + 006 (reminder schedule)
- `9df53a9` Telegram timesheet vertical (live-verified `@timesheettrial_bot`)
- `7cf0d40` Shopify editor vertical (live-verified `zizrev-ej.myshopify.com`)
- `559bf9c` admin UI: toast + send-burst + CSS animations
- `11a13db` dev: disable PWA on localhost + filter browser-extension errors
- `734eadb` docs: HANDOFF + full v2 vision pack (PRD, transition plan, landing copy, blog, sales)

### Gaps 1–7 (the actual v2 delta)
- `a8475a6` landing copy — `/` and `/memory` reframed to closed loop / shared brain / BYOM
- `19f6e4f` lessons read into the chat system prompt (`/api/chat` + `/api/v1/chat`)
- `7b45271` `@mention` parser (`src/lib/mention-dispatch.ts`) — role whitelist + INTERNAL_SECRET
- `0b32e85` shared memory facade (`src/lib/memory.ts`) — `queryCompanyMemory` over 4 sources
- `9c162c7` `/admin/memory` page — BrainIcon + sidebar nav + type-filter chips
- `8439be3` BYOM router (`src/lib/llm-router.ts`) — anthropic / openai / openai_compat
- `03f1977` founding-vision blog post at `/blog/why-we-are-building-the-autonomous`

### Polish (B) + v3 prep (C)
- `a3b091d` mobile drawer for the admin sidebar
- `d360ca3` v3 schema — migrations 007 (knowledge graph) + 008 (agent_runs) + `knowledge-graph.ts`
- `ad9083c` `NEWVISION-TODO.md` (the persistent status doc)

### Tier 2 build-out (closed loop closes on its own)
- `595bd02` chat completions write `agent_runs` + lessons; `/admin/agents` reads real data
- `68e5561` Telegram inbound routes through CEO orchestrator
- `8f6d90a` `/admin/billing` page
- `9fc5102` email-in via Resend (`/api/messaging/email`)
- `b2721d2` Tier 2 milestone — TODO refresh

### Tier 3 — feedback, BYOK, capture pipeline, delivery (8 commits)
- `bc941f6` inter-agent feedback loop — relay writes runs/lessons + `/api/agents/runs/[runId]/feedback`
- `10749a5` webhook self-registration — `/api/admin/register-webhooks`
- `03b5d23` streaming `/api/chat` BYOM (non-tool turns route through LLM router)
- `ede73fc` per-tenant Telegram bot tokens via `user_api_keys`
- `af84f23` per-tenant Shopify credentials via `user_api_keys`
- `28bf2d9` entity extractor pipeline — `/api/memory/ingest` writes persons/decisions/commitments + edges
- `6e42b65` Deepgram audio ingest + pre-meeting brief generator (`/api/memory/ingest/audio`, `/api/memory/brief`)
- `0c6f812` Tier 3 mid-milestone — TODO refresh

### Final stretch (Vault + brief CRON)
- `007c37e` Vault re-embed UI + `/api/vault/reembed`
- `007637e` calendar ingester + pre-meeting brief CRON (`/api/calendar/ingest`, `/api/cron/pre-meeting-briefs`)

---

## Where the platform stands end-to-end

| Surface | Status |
|---|---|
| **Capture** — audio | `/api/memory/ingest/audio` → Deepgram → entity extractor → graph |
| **Capture** — text | `/api/memory/ingest` → entity extractor → graph |
| **Capture** — email | `/api/messaging/email` (Resend inbound) → CEO orchestrator → reply |
| **Capture** — chat (dashboard) | `/api/chat` streaming → BYOM + lessons + runs + mentions |
| **Capture** — chat (dev API) | `/api/v1/chat` non-streaming → BYOM + lessons + runs + mentions |
| **Capture** — Telegram | `/api/messaging/telegram` → CEO orchestrator → BYO bot reply |
| **Capture** — calendar events | `/api/calendar/ingest` → `events_log` (idempotent) |
| **Workforce** — agents | 15 role agents in `mcp/registry.ts` + prompts.ts; CEO orchestrator with delegate_task |
| **Workforce** — model | Claude Sonnet 4.6 default; BYOM via `user_api_keys` (anthropic / openai / openai_compat) |
| **Workforce** — closed loop | Every run writes a lesson; next run reads top-5; `/feedback` endpoint flips outcomes |
| **Delivery** — pre-meeting brief | `/api/memory/brief` generator + `/api/cron/pre-meeting-briefs` CRON (every 5 min) |
| **Delivery** — daily digest | `src/lib/debrief.ts` (Telegram → Email → Dashboard fallback) |
| **Admin** — overview, agents, approvals, notifications, vault, memory, integrations, billing, provisioning, shopify, timesheets | All shipping; mobile drawer; mock fallback for empty tables |
| **Multi-tenant** — outbound Telegram | `sendMessageForCompany` reads per-tenant token |
| **Multi-tenant** — Shopify | `loadShopifyConfigForCompany` reads per-tenant creds |
| **Multi-tenant** — inbound Telegram | Single env-bot URL; per-bot routes are the one Tier 3 item not yet built |

---

## File map (anchors for the next agent)

### New library modules
```
src/lib/
  agent-runs.ts          ← run rows + completion helpers (writes from /api/chat + /api/v1/chat + /api/agents/relay + telegram + email)
  brief.ts               ← generateBrief() — pre-meeting brief synthesis (Claude path + deterministic fallback)
  deepgram.ts            ← transcribeAudioFromUrl / FromBuffer
  entity-extractor.ts    ← ingestConversation() — Claude tool-use that fills persons/decisions/commitments
  knowledge-graph.ts     ← typed surface over migrations 007/008 (persons/conversations/decisions/commitments/events_log/artifacts/knowledge_edges)
  llm-router.ts          ← provider-agnostic chat completion (anthropic / openai / openai_compat)
  memory.ts              ← queryCompanyMemory() — unified read over 4 sources + graph
  mention-dispatch.ts    ← @Role whitelist parser + /api/agents/relay invoker
```

### New API routes
```
src/app/api/
  admin/register-webhooks/route.ts   ← self-register Telegram on deploy
  agents/runs/[runId]/feedback/route.ts ← flips lesson outcomes
  calendar/ingest/route.ts           ← write events_log
  cron/pre-meeting-briefs/route.ts   ← scan + brief + email
  memory/{ingest,brief}/route.ts     ← graph writer + brief generator endpoints
  memory/ingest/audio/route.ts       ← chains Deepgram → entity extractor
  messaging/email/route.ts           ← Resend inbound → CEO orchestrator
  vault/reembed/route.ts             ← re-run embedding provider for missing/all chunks
```

### New admin pages
```
src/app/admin/
  billing/page.tsx                       ← credits + plan + top-ups + transactions
  memory/page.tsx                        ← shared brain surface with type-filter chips
  vault/_components/reembed-button.tsx   ← client component wired to the API
```

### Touched (existing files extended)
```
src/app/api/chat/route.ts            ← lessons read + @mention parser + agent_runs + BYOM
src/app/api/v1/chat/route.ts         ← lessons + mentions + BYOM + agent_runs
src/app/api/agents/relay/route.ts    ← agent_runs + lessons for target agent
src/app/api/messaging/telegram/route.ts ← CEO orchestrator routing + per-tenant bot tokens
src/lib/lessons.ts                   ← + updateLessonForRun
src/lib/telegram.ts                  ← + sendMessageForCompany + setWebhookForCompany + isTelegramBYOK
src/lib/shopify.ts                   ← + loadShopifyConfigForCompany + isShopifyBYOK
src/lib/vault.ts                     ← + reembedAllForCompany
src/lib/knowledge-graph.ts           ← + createEventLog + updateEventMetadata + getEventsAcrossTenantsBetween
src/app/admin/_components/sidebar.tsx ← mobile drawer + Brain/Billing nav entries
src/app/admin/_components/icons.tsx  ← BrainIcon + BillingIcon + MenuIcon
src/proxy.ts                         ← /api/vault gated; /api/memory + /api/admin intentionally not (internal-secret bypass)
src/app/page.tsx + src/app/memory/page.tsx ← landing copy elevated to v2 vision
src/app/blog/page.tsx                ← founding-vision post listed first
```

### Migrations
```
migrations/
  001_rls_policies.sql           (pre-session)
  002_vault.sql                  (pre-session)
  003_lessons.sql                (Phase 0)
  004_tenant_provisioning.sql    (Phase 0)
  005_timesheets.sql             (Phase 0)
  006_reminder_schedule.sql      (Phase 0)
  007_knowledge_graph.sql        ← v3 (persons/conversations/decisions/commitments/events_log/artifacts/knowledge_edges)
  008_agent_runs.sql             ← local run index
```

### Test files added (22 new tests)
```
test/
  agent-runs.test.ts             (6)
  brief.test.ts                  (5)
  deepgram.test.ts               (6)
  entity-extractor.test.ts       (6)
  llm-router.test.ts             (7)
  memory.test.ts                 (9)
  mention-dispatch.test.ts       (13)
  knowledge-graph.test.ts        (14 + 3 added later for events_log)
```

---

## Key architectural decisions

1. **No new schema for v2** — `queryCompanyMemory` unifies 4 already-existing sources (per-agent memory, lessons, vault chunks, activity feed). Only v3 added new tables (migrations 007/008), and those are additive (zero behavior change until applied + populated).
2. **BYOM rides on existing BYOK infrastructure** — `user_api_keys` was already used for tool credentials (Apollo, Instantly). LLM providers (`anthropic` / `openai` / `openai_compat`), Telegram bots (`telegram_bot_token`), and Shopify creds (`shopify_credentials`) all use the same encrypted-store. No new tables.
3. **Tool-use stays Anthropic-only** — semantics differ across providers. Routes gate: if `tools.length > 0` (Apollo / CEO), force Anthropic; else honor BYOM.
4. **CEO orchestrator routing on inbound channels** — when there's no explicit `@RoleName` prefix, prefer the CEO agent. Single tool-use iteration max (bounded by Telegram's 60s webhook timeout).
5. **Internal-secret bypass for webhook + cron paths** — `/api/admin/register-webhooks`, `/api/memory/*`, `/api/cron/*`, `/api/agents/relay`, `/api/agents/runs/*/feedback` all support `x-internal-secret` (env `INTERNAL_SECRET`) so CI/cron/Deepgram/Zoom/Fireflies can POST without a Clerk cookie.
6. **Idempotency everywhere** — `events_log` upserts on `(companyId, source, sourceRef)`; brief cron stamps `metadata.brief_sent_at`; `approval_callbacks` unique on `(card_id, action)`; relay depth-capped at 3; mention dispatch caps at 2 per chat turn.
7. **Graceful degradation** — every new module returns `null` / `[]` / `{ sent: false }` when its dependency is missing (no DATABASE_URL → empty rows; no ANTHROPIC_API_KEY → conversation persisted, extraction skipped; no DEEPGRAM_API_KEY → 503; no RESEND_API_KEY → log + no-op). Nothing throws on missing env.
8. **Closed loop closes automatically** — every chat completion + every relay writes a lesson with `outputAccepted='unknown'`. The `/api/agents/runs/[runId]/feedback` endpoint (Clerk or internal-secret) flips it to approved/rejected/modified. The next run for that agent reads the top-5 most recent lessons.

---

## What's blocking prod (Tier 1 you-actions)

1. **Rotate three secrets** — Supabase DB password, Shopify API secret, Telegram bot token. Listed in `TODO.md` § Security. (The originals were scrubbed from TODO.md but lived in transcripts.)
2. **Open the PR** — `gh pr create --base main --head newvision` or the GitHub URL up top.
3. **Apply migrations 007 + 008** — `psql $DATABASE_URL -f migrations/007_knowledge_graph.sql -f migrations/008_agent_runs.sql`. Populates nothing on its own; lets `/api/memory/*` and `/api/calendar/ingest` actually write.
4. **Deploy to Railway** — paste env from `.env.example` checklist; set `pk_live_*` / `sk_live_*` Clerk; set `INTERNAL_SECRET`, `CRON_SECRET`, `DEEPGRAM_API_KEY`, `RESEND_INBOUND_SECRET`.
5. **Register Telegram webhook** — either `curl -X POST $APP/api/admin/register-webhooks -H "x-internal-secret: $INTERNAL_SECRET"` or the manual curl in `TODO.md`.
6. **Two Railway crons**:
   - `30 11 * * *` UTC (17:00 IST) → `/api/cron/timesheet-reminders?token=$CRON_SECRET` (existing)
   - `*/5 * * * *` → `/api/cron/pre-meeting-briefs?token=$CRON_SECRET` (new — needs `events_log` populated first)
7. **Browser smoke-check with signed-in Clerk session** — the agent could only verify via curl + auth-gate redirects.

---

## Where to start next session

The single biggest open coding slice is **per-bot Telegram inbound** (`/api/messaging/telegram/[botSlug]/route.ts`) — the outbound side already supports per-tenant tokens (commit `ede73fc`); inbound is the only piece left. ~1 day.

If you'd rather extend the value already delivered: building **Google Calendar OAuth + webhook** on top of `/api/calendar/ingest` would automate event flow into `events_log` and immediately activate the pre-meeting brief CRON. ~1.5 days.

Both are listed in `NEWVISION-TODO.md` § Tier 3 remaining.

---

## Operational commands

```bash
# Test + type-check
bun run test
bunx tsc --noEmit

# Dev server
PORT=3007 bun run dev

# Apply v3 migrations
psql "$DATABASE_URL" -f migrations/007_knowledge_graph.sql
psql "$DATABASE_URL" -f migrations/008_agent_runs.sql

# Push the branch
git push origin newvision

# Open PR
gh pr create --base main --head newvision \
  --title "v2: AI-native operating system" \
  --body-file docs/vision/TRANSITION-PLAN.md

# Self-register Telegram on deploy
curl -X POST "$APP_BASE_URL/api/admin/register-webhooks" \
  -H "x-internal-secret: $INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Dry-run the brief CRON (no email, no stamp)
curl "$APP_BASE_URL/api/cron/pre-meeting-briefs?token=$CRON_SECRET&dryRun=1"

# Test entity extraction locally
curl -X POST http://localhost:3007/api/memory/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: <Clerk session cookie>" \
  -d '{ "text": "Met with Alice from Acme. We agreed to ship Q3 plan by next Friday. Bob will draft the MSA.", "kind": "meeting", "title": "Acme kickoff" }'
```

---

**The branch is shippable.** What's missing for prod is infrastructure + secrets, not code. Everything I could automate is automated.
