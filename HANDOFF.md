# HANDOFF — Coding Agent Context

> **Read this if you're a new Claude session picking up the project mid-flight.** It captures everything done in the 2026-05-02 → 2026-05-03 pivot work. For longer-term context, also read `CONTEXT.md` (business / strategy) and `README.md` (engineering setup). Pair it with `TODO.md` for the open work.

**Last updated:** 2026-05-07
**Maintainer:** abhinav@chainflux.com (matterhornso)
**Branch:** `main`
**Dev server convention:** `PORT=3007 bun run dev`

> **2026-05-07 update — two demo verticals shipped on top of the 2026-05-02/03 pivot.**
> See the bottom of this file (`## Session 2026-05-07`) for what's new in this round, what live-verifies, and what's still uncommitted.
> Test count is now **264/264** (was 229), tsc clean, migrations 001–006 applied to Supabase project `znmerxpukimtugwtfysy`.

---

## 30-second summary

TheAutonomous is a horizontal AI workforce platform — any MSME signs up, gets a CEO orchestrator agent and per-role agents (Sales, Marketing, Legal, Finance, HR, Strategy, Product, Operations, Customer Success). Communication is multi-modal: web admin portal `/admin`, WhatsApp bridge, eventually Telegram.

What just happened in the last two sessions:

1. **Backend (2026-05-02):** Built 8 backend workstreams — multi-tenant RLS, Agent SDK runtime, WhatsApp BSP routing, Vault (pgvector + Cohere), tenant provisioner state machine, lessons + escalation helpers, Tally ingest. **229/229 tests pass, type-check clean.**
2. **Admin UI v1 (2026-05-03 morning):** Built a JAA-specific admin portal (8 pages). User pivoted: "this should be horizontal, not JAA-specific."
3. **Admin UI v2 / pivot (2026-05-03 afternoon):** Reframed the entire portal as company-agnostic. CEO orchestrator pattern. Per-role agent runs. Universal vault. Generic integrations.
4. **Continuous flow + Clerk gate (2026-05-03 evening):** Replaced old `/dashboard/*` with redirects to `/admin`. Wired Clerk auth gate via `src/proxy.ts`. Onboarding now lands on `/admin`. Provisioning page polls real state machine. Real Clerk identity flows into admin sidebar/topbar. Mock data falls back gracefully when no `DATABASE_URL`. **229/229 tests still pass, tsc clean.**

**Nothing has been committed since `74b2e50` (2026-05-02 doc update).** The full uncommitted diff is enumerated below.

---

## Architecture at a glance

```
   USER FLOW                                  ADMIN PORTAL
   ─────────                                  ────────────
   /                ← public landing
       ↓ (sign up)
   /sign-in        ← Clerk
   /sign-up        ← Clerk
       ↓
   /onboarding     ← 5 steps (welcome → you → company → context → ready)
       ↓
   /provisioning/[companyId]  ← polls /api/provisioning state machine
       ↓ (state = "ready")
   /admin                            ← MAIN PRODUCT SURFACE
   ├── /admin                       ← overview hero + stats + recent runs
   ├── /admin/agents                ← roles grid: CEO orchestrator + 9 role agents
   ├── /admin/agents/[role]         ← per-role runs page (e.g. /admin/agents/sales)
   ├── /admin/agents/[role]/[runId] ← run trace (tools, output, lessons)
   ├── /admin/approvals             ← "From the CEO agent" — escalations
   ├── /admin/notifications         ← "From the CEO agent" — alerts inbox
   ├── /admin/vault                 ← universal store (docs, contracts, customer data)
   ├── /admin/integrations          ← connector grid (WhatsApp, Slack, Drive, HubSpot, Stripe, Tally, custom)
   └── /admin/provisioning          ← tenant provisioning roster
```

`src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) gates all of `/admin/**`, `/onboarding/**`, `/provisioning/**`, `/api/profile/**`, `/api/agents/**`, `/api/companies/**`, `/api/provisioning/**` behind Clerk. Unauthenticated requests get a 307 to `/sign-in?redirect_url=…`.

---

## Backend module map

| File | Purpose | Tests |
|---|---|---|
| `src/lib/tenant-context.ts` | AsyncLocalStorage propagation: `runWithTenantStore`, `getCurrentTenantContext`, `getCurrentTx` | `test/tenant-context.test.ts` ×5 |
| `src/lib/lessons.ts` | LessonsHelper.readRecent / write — cross-run learning loop | `test/lessons.test.ts` ×7 |
| `src/lib/escalation.ts` | EscalationHelper.handoff / alertSpoc / escalateToHuman — composes WhatsApp + admin_notifications | `test/escalation.test.ts` ×6 |
| `src/lib/agent-runner.ts` | Runtime: input/output validation, tool-use loop, budget enforcement (tokens/calls/wall-clock), lifecycle hooks (beforeRun/afterRun/onError), Langfuse-shaped trace | `test/agent-runner.test.ts` ×16 |
| `src/lib/vault.ts` | Vault module v1 — pgvector + Cohere `embed-multilingual-v3.0` (1024 dim) | `test/vault.test.ts` ×18 |
| `src/lib/vault-extractors.ts` | PAN/GSTIN/CIN/IFSC entity recognizers, wired into `vault.ingest` | `test/vault-extractors.test.ts` ×18 |
| `src/lib/tenant-provisioner.ts` | State machine: `created → schema_applied → kms_provisioned → langfuse_provisioned → vault_initialized → ready` | `test/tenant-provisioner.test.ts` ×8 |
| `src/lib/agent-sdk.ts` + `agent-sdk-helpers.ts` | `defineAgent` contract, `AgentRunContext`, `ToolBinding` | `test/agent-sdk.test.ts` |
| `src/app/api/messaging/whatsapp/webhook/route.ts` | Inbound: HMAC verification, Gupshup payload parse, route by sender phone | `test/whatsapp-routes.test.ts` |
| `src/app/api/messaging/whatsapp/callback/route.ts` | Outbound callbacks: HMAC + expiry, idempotent persistence on `(card_id, action)` | `test/whatsapp-routes.test.ts` |
| `src/app/api/integrations/tally/route.ts` | Tally on-prem ingest: bearer + cert fingerprint + idempotency | `test/tally-ingest.test.ts` |
| `src/app/api/provisioning/[companyId]/route.ts` | Returns `{ state, error, agents }` for the provisioning watcher page | (smoke-tested via curl) |

**Suite total: 229/229 tests passing across 18 files. Run with `bun run test`.**

---

## Admin UI module map

| File | Notes |
|---|---|
| `src/proxy.ts` | Clerk auth gate (Next 16 `proxy.ts`, NOT `middleware.ts`) |
| `src/app/admin/layout.tsx` | Server component. Calls `resolveTenant()` and threads firm + user into sidebar. |
| `src/app/admin/_lib/resolve-tenant.ts` | Reads Clerk `userId` → loads first company via `getCompaniesByUser`. Redirects to `/sign-in` or `/onboarding` if missing. |
| `src/app/admin/_lib/admin-data.ts` | DB-backed loaders for approvals, notifications, vault docs (graceful mock fallback when `DATABASE_URL` unset or rows empty). |
| `src/app/admin/_data/mock.ts` | Static fixture: 10 role agents (CEO orchestrator + 9 functional), runs, approvals, notifications, vault docs, integrations, provisioning roster. Company-agnostic copy (`firm.name = "Your company"`). |
| `src/app/admin/_components/sidebar.tsx` | Client component, takes `firmName / firmInitials / userInitials / userLabel` props |
| `src/app/admin/_components/topbar.tsx` | Client component. Includes Clerk `<UserButton/>`. |
| `src/app/admin/_components/icons.tsx` | 22 hand-rolled SVG icons (no external icon lib) |
| `src/app/admin/_components/primitives.tsx` | Pill, StatusDot, KeyValue, Stat, PageHeader, Section, Button, DataRow, EmptyState, SkeletonRow, Code, RelativeTime |
| `src/app/admin/page.tsx` | Overview. Real firm name in eyebrow + footer. Live run strip (mock until run table lands). |
| `src/app/admin/agents/page.tsx` | Roles grid: CEO featured full-width, 3-col bento for the 9 role agents. |
| `src/app/admin/agents/[role]/page.tsx` | Per-role runs page. Lessons + triggers (cron strings) per role. |
| `src/app/admin/agents/[role]/[runId]/page.tsx` | Run trace. Role-specific tool names + output JSON. |
| `src/app/admin/approvals/page.tsx` | Reads via `loadPendingApprovals(firmId)`. "From the CEO agent · Approvals" framing. |
| `src/app/admin/notifications/page.tsx` | Reads via `loadNotifications(firmId)`. P1/P2/P3/INFO severity. |
| `src/app/admin/vault/page.tsx` | Reads via `loadVaultDocs(firmId)`. Doc types + per-doc entities (PAN/GSTIN/etc.). |
| `src/app/admin/integrations/page.tsx` | Mock-only for now — no `integrations` table. |
| `src/app/admin/provisioning/page.tsx` | Mock-only — provisioning roster across firms. |

### What's mocked vs real (after this session)

| Surface | Source |
|---|---|
| Firm name / initials / user identity | **Real** (Clerk + companies row) |
| Approvals | **Real if DB rows exist**, else mock |
| Notifications | **Real if DB rows exist**, else mock |
| Vault docs | **Real if DB rows exist**, else mock |
| Role agents list | Mock (no `role_agents` table yet) |
| Agent runs / trace | Mock (no `agent_runs` table yet — Langfuse is the canonical run store, but we need a thin local index for the UI) |
| Integrations | Mock (no `integrations` table yet) |
| Provisioning state on `/admin/provisioning` | Mock (the `/provisioning/[companyId]` watcher *does* read real state) |

---

## Migrations

Located in `migrations/`. Apply in order: 001 → 002 → 003 → 004.

| File | Adds |
|---|---|
| `001_rls_policies.sql` | Tenant isolation: `current_company_id()` SQL helper + RLS on `companies`, `agents`, `messages`, etc. |
| `002_vault.sql` | `vault_documents`, `vault_chunks` (pgvector 1024-dim), HNSW index |
| `003_lessons.sql` | `lessons`, `admin_notifications`, `approval_callbacks` |
| `004_tenant_provisioning.sql` | Adds `provisioning_state`, `kms_key_alias`, `langfuse_project_id`, etc. columns to `companies`. Creates `tally_agent_certs`, `tally_inbox`. |

**These migrations have not been applied to any DB yet.** When `DATABASE_URL` is set, the app routes through `src/lib/db-postgres.ts`; otherwise it falls back to SQLite via `src/lib/db-sqlite.ts`.

To apply:
```bash
psql "$DATABASE_URL" -f migrations/001_rls_policies.sql
psql "$DATABASE_URL" -f migrations/002_vault.sql
psql "$DATABASE_URL" -f migrations/003_lessons.sql
psql "$DATABASE_URL" -f migrations/004_tenant_provisioning.sql
```

---

## Environment variables

See `.env.example` for the full list with comments. Tier groupings (mirroring `TODO.md`):

- **Tier 1 (Auth):** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, plus `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `_SIGN_UP_URL`, `_AFTER_SIGN_IN_URL`, `_AFTER_SIGN_UP_URL`
- **Tier 2 (DB):** `DATABASE_URL`, `ENCRYPTION_KEY`
- **Tier 3 (Agents):** `ANTHROPIC_API_KEY`, `COHERE_API_KEY`, `OPENAI_API_KEY` (optional)
- **Tier 4 (WhatsApp):** `GUPSHUP_API_KEY`, `GUPSHUP_APP_NAME`, `GUPSHUP_SOURCE_NUMBER`, `WHATSAPP_WEBHOOK_SECRET`, `WHATSAPP_CALLBACK_SECRET`
- **Tier 5 (Misc):** `TALLY_INGEST_TOKEN`, `PROVISIONER_SELF_SERVE`, `STRIPE_*`, `RESEND_API_KEY`, `INTERNAL_SECRET`, `NEXT_PUBLIC_APP_URL`, `APP_BASE_URL`

---

## How to run

```bash
bun install
cp .env.example .env.local
# fill in at minimum NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY
bun run dev
# dev server on http://localhost:3000 (or PORT=3007 for past convention)

# tests:
bun run test            # run-once
bun run test:watch      # watch mode

# type-check:
bunx tsc --noEmit
```

To smoke-test the auth gate without signing in:
```bash
curl -sS -o /dev/null -w "/admin %{http_code} -> %{redirect_url}\n" http://localhost:3007/admin
# expect: /admin 307 -> http://localhost:3007/sign-in?redirect_url=...
```

To restart a stuck dev server:
```bash
lsof -ti:3007 | xargs kill -9; sleep 1
PORT=3007 bun run dev > /tmp/admin-dev.log 2>&1 &
echo $! > /tmp/admin-dev.pid
```

---

## What's blocking go-live (high level)

| Status | Blocker |
|---|---|
| 🟥 Not started | Gupshup BSP signup (1–3 day Meta lead time) |
| 🟥 Not started | Supabase project + migrations applied |
| 🟥 Not started | Anthropic + Cohere API keys in `.env.local` |
| 🟥 Not started | Deploy target picked (Railway recommended) |
| 🟧 In progress | Code: AgentRunner not yet invoked from WhatsApp webhook |
| 🟧 In progress | Code: no `agent_runs` / `integrations` tables yet — admin pages partially mocked |
| 🟧 In progress | Code: no `/api/health` endpoint |

See `TODO.md` for the full tier-by-tier breakdown of "from you" vs "from me" work.

---

## File-level diff since `74b2e50` (current uncommitted work)

### Added
- `migrations/003_lessons.sql`
- `migrations/004_tenant_provisioning.sql`
- `src/lib/tenant-context.ts`
- `src/lib/lessons.ts`
- `src/lib/escalation.ts`
- `src/lib/agent-runner.ts`
- `src/lib/vault-extractors.ts`
- `src/lib/tenant-provisioner.ts`
- `src/app/api/messaging/whatsapp/webhook/route.ts`
- `src/app/api/messaging/whatsapp/callback/route.ts`
- `src/app/api/integrations/tally/route.ts`
- `src/app/api/provisioning/[companyId]/route.ts`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/agents/page.tsx`
- `src/app/admin/agents/[role]/page.tsx`
- `src/app/admin/agents/[role]/[runId]/page.tsx`
- `src/app/admin/approvals/page.tsx`
- `src/app/admin/notifications/page.tsx`
- `src/app/admin/vault/page.tsx`
- `src/app/admin/integrations/page.tsx`
- `src/app/admin/provisioning/page.tsx`
- `src/app/admin/_data/mock.ts`
- `src/app/admin/_components/{sidebar,topbar,icons,primitives}.tsx`
- `src/app/admin/_lib/resolve-tenant.ts`
- `src/app/admin/_lib/admin-data.ts`
- `test/{tenant-context,lessons,escalation,agent-runner,vault-extractors,tenant-provisioner,whatsapp-routes,tally-ingest}.test.ts`
- `.env.example`
- `HANDOFF.md` (this file)

### Modified
- `src/lib/vault.ts` — wired `vault-extractors` into `vault.ingest`
- `src/proxy.ts` — added `/admin`, `/provisioning`, `/api/{provisioning,agents,companies,profile}` to protected routes
- `src/app/onboarding/page.tsx` — final step now redirects to `/admin` (was `/`)
- `src/app/provisioning/[companyId]/page.tsx` — now polls real `/api/provisioning/[companyId]`; redirects to `/admin` on `ready`
- `src/app/dashboard/page.tsx` — replaced with redirect to `/admin`
- `src/app/dashboard/[companyId]/page.tsx` — replaced with redirect to `/admin`
- `src/app/globals.css` — added `admin-pulse`, `admin-enter`, `.tabular` utilities
- `TODO.md` — fully rewritten as a tier-by-tier go-live checklist

### Deleted
- `src/app/admin/agents/[runId]/page.tsx` (moved to `[role]/[runId]/page.tsx` during pivot)
- `src/app/admin/tally/` (replaced by `/admin/integrations`)

The old `src/app/dashboard/[companyId]/{agents,analytics,builder,...}` subtree still exists on disk but is unreachable (parent redirects). Safe to delete in a follow-up.

---

## First 5 minutes for a new agent session

1. Read `CLAUDE.md` (project conventions + skill routing)
2. Read this file (you are here)
3. Read `TODO.md` to find the highest-priority unchecked item
4. Run `bun run test` — confirm 229 pass before changing code
5. Run `bunx tsc --noEmit` — confirm clean
6. Check dev server is up: `lsof -ti:3007 && curl -sS http://localhost:3007/ -o /dev/null -w "%{http_code}\n"`
7. If you're picking up backend wiring, the agent runner entry point is `src/lib/agent-runner.ts:run()`. Inputs documented in the file's top comment.
8. If you're picking up admin UI work, all pages are server components reading from `_lib/admin-data.ts` (DB-backed) or `_data/mock.ts` (fallback). Tenant resolution: `_lib/resolve-tenant.ts`.
9. If you're picking up WhatsApp wiring, see `src/app/api/messaging/whatsapp/webhook/route.ts` — `runWhatsAppWebhook` is dependency-injectable for testing. The next step is invoking the AgentRunner from inside this handler.

## Conventions worth knowing

- **No new dependencies casually** — 22 admin icons are hand-rolled SVGs, animations are CSS keyframes (no framer-motion, no lucide-react). DESIGN.md fonts are Instrument Serif + DM Sans + JetBrains Mono.
- **Mock fallback pattern** — every DB read in `admin-data.ts` tries Postgres, catches, returns the matching mock fixture. UI keeps working without `DATABASE_URL`.
- **Tenant isolation** — every data access goes through `resolveTenant()` in `/admin` and `runWithTenantStore()` in agent code. Postgres has RLS on every tenant-scoped table.
- **Idempotency** — WhatsApp callbacks unique on `(card_id, action)`; Tally ingest unique on `(firm_id, idempotency_key)`. Re-deliveries are no-ops.
- **No JAA-specific copy** — the user explicitly pivoted away from per-customer hard-coding mid-session. If you see "JAA & Associates" or "GST" or "Tally"-specific framing in the UI, that's stale; flag it.

---

## Session 2026-05-07 — Demo verticals (Shopify Editor + JAA Timesheets)

**One-line:** built two production-shaped client demos on top of the 2026-05-02/03 admin shell. **264/264 tests pass, tsc clean, live-verified end-to-end against real Shopify + Telegram. Still uncommitted.**

### Demo state in DB

Supabase project `znmerxpukimtugwtfysy` (Singapore, ap-southeast-1):
- Migrations 001–006 applied (lessons, vault, tenant provisioning, timesheets, reminder schedules)
- 1 Clerk user owns 1 workspace company "Abhinav's Workspace" (originally seeded as "JAA Associates", renamed via the new inline rename feature)
- 1 employee on the timesheet roster: **Girish** (`girish@jaa-associates.com`), no Telegram chat_id linked yet
- 1 outstanding submission for period `2026-W19`
- Reminder schedule active: `0 17 * * *` Asia/Kolkata

### Vertical 1 — Shopify Editor (`/admin/shopify`)

Connected to **`zizrev-ej.myshopify.com`** (the merchant's actual `.myshopify.com` handle; their public storefront is `shop.getsoma.store`). Contains a single product "Soma Sparkling Water" at the time of writing.

| File | Purpose |
|---|---|
| `src/lib/shopify.ts` | Admin GraphQL client + token cache (24h TTL). Auth via **client credentials grant** because Shopify deprecated static `shpat_…` tokens in 2026. |
| `src/lib/shopify-planner.ts` | Claude tool-use loop: agent uses `search_products` (read-only) + emits `submit_plan` with structured operations. |
| `src/lib/shopify-apply.ts` | Sequential applier; per-op error capture; partial-success reporting. |
| `src/lib/shopify-insights.ts` | Single-shot Claude call producing structured competitor analysis JSON. |
| `src/app/api/shopify/{plan,apply,insights}/route.ts` | Clerk-gated POST endpoints. |
| `src/app/admin/shopify/page.tsx` + `_components/{shopify-editor,insights-panel}.tsx` | UI. |
| `test/shopify.test.ts` | 22 unit tests covering token exchange, plan schema, apply orchestration, planner tool-use loop. |

**Live verified:** added `demo-e2e-2026-05-07` tag to Soma Sparkling Water, verified via search, removed via second plan, verified clean state. See `scripts/shopify-e2e.ts`.

**Insights call:** ~45s end-to-end; ~770 input / 2100 output tokens; returns category, market summary, competitive landscape, differentiation gap, and 5–8 prioritised suggestions. Each suggestion can be `apply` (with paste-ready prompt), `review` (human design call), or `external` (outside Shopify scope).

### Vertical 2 — JAA Timesheets (`/admin/timesheets`)

Telegram bot **`@timesheettrial_bot`** (display name "jaa timesheet").

| File | Purpose |
|---|---|
| `src/lib/timesheets.ts` | Domain logic — ISO week period keys, employee CRUD, `linkTelegramChatId`, `runReminderPass`, `markSubmitted`. |
| `src/lib/reminder-schedule.ts` | Cron-string storage + next-fire computation via `croner`. Includes human-readable `describeCron()`. |
| `src/app/api/timesheets/{employees,run-pass,mark-submitted,reset-submission,schedule}/route.ts` | Clerk-gated CRUD + actions. |
| `src/app/api/timesheets/employees/[id]/route.ts` | DELETE employee (cascades to submissions). |
| `src/app/api/cron/timesheet-reminders/route.ts` | Token-protected scheduled fire. Honors `paused` schedules and records `last_run_at`. |
| `src/app/api/messaging/telegram/route.ts` | Webhook handler. Patched to handle `/link <email>`, `DONE`, `HELP` keywords *before* the existing agent-routing fallthrough. |
| `migrations/005_timesheets.sql`, `migrations/006_reminder_schedule.sql` | Tables + RLS. |
| `src/app/admin/timesheets/page.tsx` + `_components/{timesheet-actions,schedule-card,row-actions,mark-submitted-button}.tsx` | UI. |
| `test/timesheets.test.ts` | 13 unit tests covering ISO-week computation, employee linking, reminder send, DB-stub edge cases. |

**Live verified:** `scripts/telegram-webhook-e2e.ts` runs through all 7 keyword paths against the live Next route + DB. Bot's `getMe` returns 200 (token fresh).

### Onboarding bug fix

Critical: the previous onboarding flow saved a `user_profiles` row but never created a `companies` row. New users hit `/admin` → `resolveTenant()` saw zero companies → bounced back to `/onboarding` → infinite loop. Fixed via `POST /api/companies` called from onboarding's final step. Onboarding now defaults the workspace name to `<First Name>'s Workspace` instead of asking for a company name.

### Workspace rename (inline)

Sidebar workspace pill is now click-to-rename. Saves via `PATCH /api/companies/[id]`. Useful for matching demo audience without redeploying — rename to "Soma Pilot" before getsoma meeting, "JAA Pilot" before JAA meeting.

### Admin UI primitives shipped this session

- `src/app/admin/_components/toast.tsx` — `<ToastProvider>` mounted in admin layout. `useToast()` hook returns `{ toast }`. Toasts slide in from top-right, support success/warning/danger/info tones, optional rich body, auto-dismiss with manual × close.
- `src/app/admin/_components/send-burst.tsx` — full-screen celebratory overlay. Returns `{ fire, burst }` from `useSendBurst()`. Used on Apply success in Shopify and reminder send in Timesheets.
- CSS keyframes added to `globals.css`: `admin-cta-idle` (idle button glow), `admin-cta-progress` (in-flight bottom-edge shimmer), `admin-cta-icon-{sparkle,nudge}`, `admin-spinner`, `admin-toast-{in,out}`, `admin-row-flash`, `admin-row-remove`, `admin-burst-{backdrop,card,check,particle,ring}`.

### Dev-only fixes

- `pwa-register.tsx` — service worker registration **skipped on `localhost`/`127.0.0.1`** and any leftover worker is auto-unregistered on page load. Stops bundle-cache pain during HMR.
- `src/app/layout.tsx` head — inline script swallows `chrome-extension://` errors so the Next dev overlay doesn't surface MetaMask noise.

### Files added this session

```
migrations/005_timesheets.sql
migrations/006_reminder_schedule.sql
scripts/init-base-schema.ts          (helper: bootstrap base tables on a fresh DB)
scripts/shopify-smoke.ts
scripts/shopify-tags.ts              (verify mutations landed)
scripts/shopify-e2e.ts               (full plan → apply → rollback)
scripts/shopify-insights-test.ts     (live insights run)
scripts/timesheet-e2e.ts
scripts/telegram-webhook-e2e.ts

src/lib/shopify.ts
src/lib/shopify-planner.ts
src/lib/shopify-apply.ts
src/lib/shopify-insights.ts
src/lib/timesheets.ts
src/lib/reminder-schedule.ts

src/app/api/companies/route.ts
src/app/api/companies/[id]/route.ts
src/app/api/cron/timesheet-reminders/route.ts
src/app/api/shopify/{plan,apply,insights}/route.ts
src/app/api/timesheets/{employees,employees/[id],run-pass,mark-submitted,reset-submission,schedule}/route.ts

src/app/admin/_components/toast.tsx
src/app/admin/_components/send-burst.tsx
src/app/admin/shopify/page.tsx
src/app/admin/shopify/_components/{shopify-editor,insights-panel}.tsx
src/app/admin/timesheets/page.tsx
src/app/admin/timesheets/_components/{timesheet-actions,schedule-card,row-actions,mark-submitted-button}.tsx

test/shopify.test.ts
test/timesheets.test.ts
```

### Files modified this session

```
src/app/onboarding/page.tsx          (POST /api/companies on final step + user-centric workspace default)
src/app/admin/_components/sidebar.tsx (Timesheets + Shopify Editor entries; click-to-rename workspace)
src/app/admin/_components/icons.tsx   (TrashIcon, ResetIcon, ShopIcon, TimesheetIcon, SpinnerIcon)
src/app/admin/_components/primitives.tsx (no functional change)
src/app/admin/layout.tsx             (ToastProvider, firmId/workspaceCount props)
src/app/api/messaging/telegram/route.ts (link/DONE/HELP keywords before agent routing)
src/app/components/pwa-register.tsx  (dev: skip + unregister)
src/app/layout.tsx                   (extension-error filter)
src/app/globals.css                  (all the new admin animations)
src/proxy.ts                         (gate /api/shopify, /api/timesheets)
.env.example                         (SHOPIFY_*, CRON_SECRET, expanded TELEGRAM_*)
```

### What's NOT done (handed to TODO.md)

- Working tree still uncommitted — see `TODO.md` § "Post-demo / go-live" for the recommended commit split
- Secrets rotation (DB password, Shopify secret, Telegram token were all in transcript)
- Production deploy + Telegram webhook registration + Railway cron
- Browser spot-checks of click-throughs that I can't do without a Clerk session
