# TODO — Coding Agent Handoff

> Source of truth for outstanding work in **the main app** (`theautonomousorg`). For memory-product work, see `autonomous-memory/TODO.md`. Read this file's "How to use" section first. Mark items complete with `[x]` and add the date.

**Last updated:** 2026-05-02
**Maintainer:** abhinav@chainflux.com

> **2026-05-02 strategy update:** TheAutonomous repositioned as a horizontal AI workforce platform for Indian MSMEs. JAA & Associates is the first paid customer (verbal; deposit pending). Memory and Vault as standalone products are RETIRED; Vault name is now the per-tenant knowledge base module. See `~/.gstack/projects/matterhornso-theautonomousorg/abhinavramesh-main-design-20260501-162924.md` for the locked design.

## What shipped this session (2026-05-02)

| Commit | Module | Lines | Tests |
|--------|--------|-------|-------|
| `8a40301` | gstack skill routing in CLAUDE.md | +18 | — |
| `d2278ae` | Multi-tenant RLS migration + helper (NOT applied to DB) | +707 | +7 |
| `1141aa0` | Agent SDK contract + A4 Bank Recon reference | +841 | +22 |
| `9fa201d` | WhatsApp BSP router (W4) — implements WhatsAppHelper | +661 | +20 |
| `c54b9fe` | Vault module v1 (W5) — pgvector schema + ingest/query | +715 | +18 |

**Suite total: 144/144 tests passing across 11 files. Type-check clean.**
**Repos:**
- Main app: `/Users/abhinavramesh/theautonomousorg` (this repo's TODO covers items here)
- Memory app + rowboat fork: `/Users/abhinavramesh/autonomous-memory` (separate `TODO.md` lives there)

## Before you start

Read in order, then return here:

1. `CONTEXT.md` — what this platform is and its current state
2. `README.md` — how to run, where things live, runbook
3. (this file) — pick a task

Don't skip the context files even if the task seems self-explanatory — many items here have a *why* that's non-obvious from the file paths alone.

---

## How to use this file

1. Pick the highest-priority unchecked item from the section that matches your task type.
2. Read the linked file paths before changing anything.
3. Run `npm test` and `curl http://localhost:3000/api/health` before committing.
4. Update this file: check the box, add the date, note any follow-ups.
5. Commit with conventional-commit prefix (`feat:`, `fix:`, `chore:`, `docs:`).

Section legend:
- 🔴 **P0 — Blocking:** must be done before launch / before next user touches the app
- 🟠 **P1 — High impact:** measurable conversion / revenue / reliability win
- 🟡 **P2 — Polish:** quality-of-life, technical debt, nice-to-have
- 🔵 **Backlog:** ideas, not yet scoped

---

## 🔴 P0 — Action Items Requiring User (Abhinav)

These cannot be done by a coding agent alone — they need credentials, account access, or human decisions. List what's needed from you below; pass values to the agent via secure channel (1Password, env vars, etc.).

### Main app (theautonomousorg)

- [ ] **Fix SSL cert on theautonomous.org.** The cert currently served is the Railway wildcard `*.up.railway.app` (issuer: Certainly), not a cert for the custom domain. Browsers throw `NET::ERR_CERT_COMMON_NAME_INVALID`. Re-issue via Railway → Settings → Domains → re-add `theautonomous.org`, wait for Let's Encrypt issuance.
- [ ] **Fix DATABASE_URL in Railway.** Currently points to `db.znmerxpukimtugwtfysy.supabase.co` (deleted/wrong project). Per `CONTEXT.md` the live project is `hobjxomvmxradkgnivol`. Update `DATABASE_URL` in Railway to the pooler URL for that project. Without this, `/api/health` returns 503 and no production traffic works.
- [ ] **Decide: keep Supabase free tier or upgrade to Pro.** Free tier auto-pauses after 7 days of inactivity. Pro is $25/mo and never pauses. *Required input: yes/no decision.*
- [ ] **Switch Clerk to production keys.** Currently using `pk_test_*` / `sk_test_*` (dev keys show "Development mode" badge and have rate limits). *Required input:* `pk_live_*` and `sk_live_*` from [Clerk dashboard](https://dashboard.clerk.com).
- [ ] **Add production env vars to Railway.** Local `.env.local` is set, but Railway production needs: `RESEND_API_KEY`, production Clerk keys, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ENCRYPTION_KEY`. **NEW for the MSME platform build:** `GUPSHUP_API_KEY`, `GUPSHUP_APP_NAME`, `GUPSHUP_SOURCE_NUMBER`, `WHATSAPP_WEBHOOK_SECRET`, `WHATSAPP_CALLBACK_SECRET`, `COHERE_API_KEY` (for Vault embeddings; OpenAI fallback works), `APP_BASE_URL`. *Required input:* run `railway variables set` for each, or paste into Railway dashboard.
- [ ] **Deploy latest code to Railway.** **5 un-deployed commits ahead of origin/main as of 2026-05-02**: gstack routing, RLS infra, Agent SDK, WhatsApp router, Vault module. ~3000 lines, 144/144 tests green. *Required input:* approval to push to `main`.
- [ ] **Add Stripe webhook endpoint in Stripe dashboard** pointing to `https://theautonomous.org/api/billing/webhook`, then copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] **Verify Resend domain** for `theautonomous.org` if not already.
- [ ] **Provision Gupshup BSP account** with the platform-shared WhatsApp Business number (locked decision 1C-B). Lead time: 3–7 days for Meta business verification. Required for any WhatsApp agent work.
- [ ] **Sign Anthropic processor addendum** for cross-border data flow under DPDP. Existing relationship with Anthropic; this is a paperwork item. Blocks production agent runs from being lawful for JAA's data.
- [ ] **Apply migrations 001 + 002 (RLS + Vault) to a STAGING Supabase project FIRST.** Do NOT apply to production until: (a) every server-side query path is wrapped in `withTenantContext()` (RLS PR 2 below), and (b) staging passes the regression suite. Order: 001 → 002.

### JAA-specific (this week)

- [ ] **Pre-call JAA SPOC to confirm restructured SOW shape.** Outside-voice 6A risk you accepted: SOW going out cold without verbal confirmation that JAA will accept ₹2L/month sub + ₹40-80L services (vs. the verbal's likely ₹40-80L flat-fee shape). Have the old-shape SOW drafted as a fallback so you can pivot in hours.
- [ ] **Send JAA the SOW** (standard sub + implementation services + 25% deposit due before week-1 work begins).
- [ ] **Track JAA deposit by Friday** as the truth-telling forcing function.

### Rowboat fork (autonomous-memory/apps/rowboat) — **RETIRED**

The Memory product as a standalone offering is retired per the 2026-05-01 strategy lock. The rowboat fork should be archived. The voice → entities → exec brief surface is killed; the cross-run learning pattern moved into the Vault module (`src/lib/vault.ts`) inside the main app.

- [ ] **Archive `/Users/abhinavramesh/autonomous-memory/`** (move to `~/archive/` or push to a dedicated `autonomous-memory-retired` repo with an ARCHIVED.md note explaining the strategy change).
- [ ] **Send retirement notice** to anyone on the `/memory-waitlist` (Resend campaign: "Memory product is retired; check out TheAutonomous platform sub").
- [ ] **Disable `/memory` landing page** in the main app, or redirect to the platform sub page.

---

## 🟠 P0 — Coding Agent Can Do (next session priorities)

These are the buildable next steps after the production blockers above are unblocked. Sequence matters: items further down depend on items above.

### Multi-tenant RLS (continuing the d2278ae work)

- [ ] **PR 2: Pick the tenant-context propagation pattern.** Three options (architectural decision needed): (a) explicit `tx` parameter through every db function, (b) AsyncLocalStorage to carry context through async boundaries, (c) `sql.reserve()` per request. Each shapes the 188 db.ts call site refactor differently. **Recommendation: AsyncLocalStorage** — most idiomatic Node.js, no API change to existing db functions, single addition to `src/lib/tenant-context.ts`. Once picked, refactor follows.
- [ ] **PR 2: Audit + wrap every server-side query path** in `withTenantContext()`. 188 call sites in `src/lib/db-postgres.ts` + 43 API routes. Target: every tenant-scoped read/write has the GUC set.
- [ ] **PR 3: Apply migrations 001 + 002 to a STAGING Supabase**, run regression suite, verify no existing flow broke.
- [ ] **PR 4: Apply to production behind feature flag** `RLS_ENFORCED=true`. Roll out to JAA first, then firm #2.

### Agent runtime (using the SDK from 1141aa0)

- [ ] **AgentRunner**: the runtime that loads an `AgentDefinition`, builds `AgentRunContext` (with helpers wired via `buildWhatsAppHelper` + `buildVaultHelper` + lessons + escalation), validates input, calls the LLM with retries + budget enforcement, validates output, runs lifecycle hooks, writes Langfuse trace.
- [ ] **Lessons table implementation**: thin wrapper over the existing `memory` table (or new `lessons` table) implementing the `LessonsHelper` interface. Per-agent + per-firm partition.
- [ ] **Escalation helper implementation**: composes `whatsapp.sendNotification` + admin portal notifications.
- [ ] **Fork the remaining 30 CA pack agents** off `src/lib/packs/ca-firm/a4-bank-recon.ts`: A1, A3, A5, A7, A8, T1, T3, T4, R1, R3, R4, Q1, Q2, Q4, H1, H4, AP1, IT1, P1, P2, P3, Adm1, Adm3, B1, B3, E1, E2, I1, I2, plus the Command Agent. Each is a ~150-200 line file.

### WhatsApp (continuing 9fa201d)

- [ ] **`/api/messaging/whatsapp/webhook` route handler**: validates Gupshup signature, parses inbound messages, calls `routeInboundMessage`, dispatches to AgentRunner.
- [ ] **`/api/messaging/whatsapp/callback` route handler**: receives signed approval-button clicks, validates HMAC + expiry, executes the action with idempotency.
- [ ] **WhatsApp template library**: 40–60 utility templates × 2 languages submitted to Meta for first-time-sender approval. Lead time: 24–72 hours per template, sometimes 5–7 days. Submit week 1.

### Vault (continuing c54b9fe)

- [ ] **Bilingual entity extraction (vault-extractors.ts)**: GSTIN/PAN/CIN/IFSC recognizers using regex + Cohere structured-extraction. Indian context tuning that the design doc Vault rich-v1 promised.
- [ ] **Re-embed delta on source-doc change**: chunk diff + selective re-embed.
- [ ] **Tombstone cleanup cron**: archive deleted_at + tombstoned chunks past retention.

### Tally on-prem agent (W3) — separate repo

- [ ] **Create `theautonomousorg-tally-agent` repo**: Windows .NET 6 service, polls Tally XML on local TCP 9000, pushes to platform via mTLS tunnel. Per locked decision 1B-B: per-firm cert, read-only by default, writes require SPOC-signed request + audit log.
- [ ] **`/api/integrations/tally` ingestion endpoint** in main app: receives mTLS-authenticated payloads, validates per-firm cert against issuer chain, writes to Postgres tenant-scoped tables.

### Per-firm KMS encryption (W2) — depends on RLS PR 2

- [ ] **`src/lib/kms.ts`**: per-firm AWS KMS CMK provisioning + envelope-encrypted DEKs per BYOM key. Per locked decision 1D-A.
- [ ] **Migrate existing user_api_keys table** from `ENCRYPTION_KEY` AES-256-GCM to KMS-envelope.

### Tenant provisioning state machine (W9)

- [ ] **`src/lib/tenant-provisioner.ts`**: idempotent provisioning of per-firm Postgres schema + KMS CMK + Langfuse project + pgvector index. **Cap self-serve sub at "waitlist mode" until provisioner is tested at ≥5 tenants** (outside-voice 3 risk).
- [ ] **Per-firm cost telemetry**: emit per-tenant token counts + INR cost into Langfuse from week 1 so the Subscription module markup decision (35-50%? 100%?) is data-driven by month 2.

### Production reliability

- [ ] **Postgres connection-pooling check at startup**: detect "Tenant or user not found" at boot, log a clear warning instead of failing per-request. File: `src/lib/db-postgres.ts`.
- [ ] **Uptime monitoring**: hit `https://theautonomous.org/api/health` every 5 min from BetterStack/UptimeRobot. Alert on 503.
- [ ] **Sentry or equivalent error tracking**: wire into `src/app/layout.tsx` and `src/lib/db.ts`.

---

## 🔴 P0 — Bugs / Blockers (Coding Agent Can Do)

### Main app

- [x] ~~Supabase project paused → DB connection fails~~ — Restored 2026-04-28 via Supabase MCP.
- [x] ~~Rowboat fork: missing `framer-motion` peer dep~~ — Installed 2026-04-28 (`npm install framer-motion --legacy-peer-deps`).
- [ ] **Rowboat fork: `localStorage.getItem is not a function` SSR error.** Happens on Node 25 in Clerk keyless mode. Two possible fixes:
  - **A) Pin Node 22 LTS** in `apps/rowboat/.nvmrc` and `package.json` `engines` field.
  - **B) Provide real Clerk keys via `.env.local`** so Clerk doesn't go into keyless mode.
  Recommend doing both. Verify with `cd apps/rowboat && npm run dev` then `curl http://localhost:3001/`.

### Cross-cutting

- [ ] **`/pricing` returns 404.** Pricing CTAs are wired to a Clerk modal (per recent commit), but search engines and direct links to `/pricing` will 404. Either:
  - Build a real `/pricing` page with the same tiers shown elsewhere, or
  - Add `/pricing` → `/#pricing` redirect in `next.config.ts`.

- [ ] **Console 401 from Clerk on page load.** Single 401 from a Clerk background request appears in browser console. Cosmetic but noisy. Investigate `proxy.ts` middleware config.

---

## 🟠 P1 — High Impact (Coding Agent Can Do)

### Conversion / UX (Main app)

- [ ] **Add loading progress for `/api/analyze`.** Claude takes 25–45s; users see only "Analyzing…" spinner. This is the #1 abandonment point. Implement either:
  - SSE streaming with milestones ("Reading site…", "Identifying agents…", "Building recommendations…")
  - Or a static "This usually takes 20–30 seconds" message + indeterminate progress bar
  - File: `src/app/components/dashboard/` (analyze form), `src/app/api/analyze/route.ts`
- [ ] **Add product demo video or GIF.** No media on landing page. A 30-second screen recording of the analysis flow (URL → recommendations → launch) would massively increase conversion. Place in `public/demo.mp4` and embed below the hero.
- [ ] **Replace hypothetical use cases with real ones.** "A B2B SaaS startup" reads as fabricated. Even one real customer name + quote 10x's credibility. Find and update in landing-page sections.
- [ ] **Add OG-image as a proper PNG.** Current `og-image` is SVG. LinkedIn and iMessage don't render SVG previews. Generate 1200×630 PNG and update `metadata` in `src/app/layout.tsx`.

### Reliability

- [ ] **Add Postgres connection pooling check to startup.** Detect "Tenant or user not found" at boot and log a clear warning instead of failing per-request. File: `src/lib/db-postgres.ts`.
- [ ] **Set up uptime monitoring.** Hit `https://theautonomous.org/api/health` every 5 minutes from BetterStack / UptimeRobot. Alert on 503 to Slack/email.
- [ ] **Add error tracking.** Wire Sentry (or similar) into `src/app/layout.tsx` and `src/lib/db.ts`. Currently errors are console-logged and lost.

### Rowboat fork

- [ ] **Get rowboat dev server returning 200 on `/`.** After P0 bugs are fixed, verify the full boot loop: Clerk loads → MongoDB connects → Redis connects → renders `/projects`. File: `apps/rowboat/app/page.tsx`, `apps/rowboat/app/app.tsx`.
- [ ] **Implement voice upload pipeline.** Spec is in `apps/rowboat/CLAUDE.md`: audio → Deepgram → entity extraction (Claude) → MongoDB knowledge graph. Target latency: <5s end-to-end. Files referenced: `apps/rowboat/app/api/voice/route.ts`, `apps/rowboat/app/api/memory/route.ts`.
- [ ] **Implement pre-meeting brief generation.** Query knowledge graph by attendee → Claude synthesis → structured markdown brief. File: `apps/rowboat/app/api/brief/route.ts`.
- [ ] **Implement Stripe checkout for Early Access / Executive tiers.** Files: `apps/rowboat/app/lib/stripe.ts`, `apps/rowboat/app/api/stripe/checkout/route.ts`, `apps/rowboat/app/api/stripe/portal/route.ts`, `apps/rowboat/app/api/stripe/webhook/route.ts`.

---

## 🟡 P2 — Polish / Tech Debt

### Main app

- [ ] **Make FAQ section collapsible.** All 8 FAQs are currently expanded as static text, adding ~2000px to the homepage. Use accordion pattern. File: `src/app/components/` (find FAQ section in landing).
- [ ] **Reduce homepage length.** Currently ~9700px (13+ screens). Consolidate the "Not chatbots. Actual teammates." section (8 cards) with the "How it works" section.
- [ ] **Sign-up page title missing "Sign Up" prefix.** Title is `"The Autonomous — AI Agents..."` instead of `"Sign Up | The Autonomous..."` like sign-in. File: `src/app/sign-up/[[...sign-up]]/page.tsx`.
- [ ] **Add `vitest` coverage report.** Currently no coverage gate. Add `--coverage` to CI and set threshold (start at 60%).
- [ ] **TypeScript strict null checks.** `tsconfig.json` is strict but a few files use `as` casting that hides nulls. Audit and remove.
- [ ] **Replace in-memory rate limiting** (`src/lib/rate-limit.ts`) with Redis-backed (Upstash) for multi-instance deploys.
- [ ] **Audit `useEffect` data fetching.** Several dashboard components fetch in `useEffect` instead of using server components. Migrate where possible.
- [ ] **Remove unused agent role icons.** `src/app/components/agent-icons.tsx` likely has dead exports — run `ts-prune` to confirm.

### Rowboat fork

- [ ] **Pin Node version.** Add `apps/rowboat/.nvmrc` with `22.11.0` and `engines.node` in `package.json`.
- [ ] **Update HeroUI to stable.** Currently on `2.8.0-beta.10` — beta. Upgrade once stable is released, retest.
- [ ] **Remove `--legacy-peer-deps` workaround.** Caused by HeroUI beta + Clerk 7. Once HeroUI ships stable + supports React 19 cleanly, run plain `npm install`.
- [ ] **Add `.env.local.example`** in fork that mirrors `.env.example` but with safe placeholder values (no `pk_live_...` strings that look like real keys).
- [ ] **Document MongoDB schema.** Knowledge-graph collections (Person, Conversation, Commitment, Event, Note) should have a schema doc with example documents and indexes. Add to `apps/rowboat/DESIGN.md` or create `apps/rowboat/SCHEMA.md`.

### Cross-cutting

- [ ] **Unify Clerk config.** If both apps share Clerk, document it in this file's "Cross-app conventions" section so future agents don't fork the auth flow.
- [ ] **CI pipeline.** No GitHub Actions config visible. Add: lint, typecheck, test, build for each push.
- [ ] **Pre-commit hooks.** Use `husky` + `lint-staged` to run `prettier` + `eslint` on staged files.
- [ ] **Update `CLAUDE.md`** in main app to mention the rowboat fork relationship and to point at this `TODO.md`.

---

## 🔵 Backlog — Ideas (Not Yet Scoped)

### Product

- [ ] **Slack integration as a messaging surface** (alongside Telegram and WhatsApp). Many SMB users live in Slack.
- [ ] **Voice-first onboarding** in the main app: "Tell us about your company" via the browser microphone → Claude transcribes and analyzes → recommendations.
- [ ] **Agent eval leaderboard** publicly visible — show which agent roles produce highest-quality work (anonymized).
- [ ] **White-label mode** for agencies — let agencies sell The Autonomous under their own brand.
- [ ] **Agent marketplace** — let users publish and install community-built agent presets.
- [ ] **Mobile app (iOS/Android)** — currently the web app is responsive but a native app would help with push notifications for agent updates.

### Engineering

- [ ] **Move task processor to a queue** (BullMQ on Redis, or SQS). Currently `croner` schedules in-process which doesn't scale across replicas.
- [ ] **Postgres → Drizzle ORM** migration. Currently raw SQL via `postgres` package. Drizzle would give compile-time schema safety.
- [ ] **Multi-tenant database isolation.** Currently all companies share tables with `company_id` column. For larger customers, consider row-level security (Postgres RLS).
- [ ] **Streaming chat UI fallbacks** for slow connections (current SSE has no reconnect logic).
- [ ] **Webhook retry queue** with exponential backoff for `/api/webhooks/*` deliveries.

### Memory product (rowboat fork)

- [ ] **Calendar integration** — auto-trigger pre-meeting brief 15 min before each Google Calendar event.
- [ ] **CRM sync** — write extracted entities back to HubSpot/Salesforce/Pipedrive.
- [ ] **Chrome extension** — capture conversations from Gmail / LinkedIn / WhatsApp Web directly into the knowledge graph.
- [ ] **Recall-style "moments" view** — timeline of past conversations with searchable transcripts.

---

## Cross-App Conventions

- **Clerk auth is shared** (planned) between main app and rowboat fork. Don't fork the sign-in flow — reuse `@clerk/nextjs` instance.
- **Design system** is defined in `DESIGN.md` (one per repo). They share fonts (Instrument Serif + DM Sans) and accent color (#D4A853). Read before any UI change.
- **Database boundaries:**
  - Main app → SQLite (dev) / Supabase Postgres (prod). Schema in `src/lib/db-sqlite.ts`.
  - Rowboat fork → MongoDB (knowledge graph) + Redis (queues). Schema in `apps/rowboat/src/entities/models/`.
  - **Never share data across these databases directly.** Use HTTP APIs if cross-product data is needed.
- **Background work** lives in workers (`src/worker.ts` for main; `apps/rowboat/app/scripts/jobs-worker.ts` for memory). Don't run long-running tasks inline in API routes.
- **Secrets policy:** never commit `.env.local`, never log full tokens. Use AES-256-GCM (`ENCRYPTION_KEY` env var) for at-rest encryption of user-supplied API keys (`src/lib/db-sqlite.ts` `storeUserApiKey`).

---

## Recently Completed (for context)

- 2026-04-28 — Restored Supabase project from `INACTIVE` → `ACTIVE_HEALTHY`.
- 2026-04-28 — Installed `framer-motion` in rowboat fork (HeroUI peer dep).
- 2026-04-28 — Wrote new README.md and TODO.md for handoff.
- 2026-04-XX — Replaced Chainflux branding with The Autonomous Org across all pages (commit `fe70608`).
- 2026-04-XX — Wired pricing CTAs to Clerk modal, fixed newsletter error layout (commit `89a08ac`).
- 2026-04-XX — Made DB connection errors non-fatal in `/api/analyze` (commits `bc56b58`, `a86383a`).
- 2026-04-XX — Wired up newsletter + contact forms via Resend, fixed PWA icons (commit `3153b6c`).

---

## Useful Commands

```bash
# Main app
cd /Users/abhinavramesh/theautonomousorg
npm run dev                           # Start on :3000
npm test                              # Vitest
curl http://localhost:3000/api/health # Sanity check

# Rowboat fork
cd /Users/abhinavramesh/autonomous-memory/apps/rowboat
npm run dev                           # Start on :3000 (uses Turbopack)
npm run mongodb-ensure-indexes        # Set up MongoDB indexes
npm run setupQdrant                   # Set up Qdrant vectors
npm run rag-worker                    # Run RAG worker
npm run jobs-worker                   # Run background jobs worker

# Both
git status
git log --oneline -20
gh pr create
```

## Quick References

- Supabase project ref: `hobjxomvmxradkgnivol` (region: `ap-southeast-1`)
- Production URL: `theautonomous.org`
- Memory app target URL: `memory.theautonomous.org`
- Clerk dashboard: [dashboard.clerk.com](https://dashboard.clerk.com)
- Railway dashboard: [railway.app/project/...](https://railway.app)
- Resend dashboard: [resend.com/domains](https://resend.com/domains)
- Stripe dashboard: [dashboard.stripe.com](https://dashboard.stripe.com)
