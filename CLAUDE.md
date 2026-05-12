# TheAutonomous.org

## Coding Agent Read Order

If you are an AI coding agent picking up work, read these files **in this order before writing any code**:

1. `CONTEXT.md` — Platform context (both this app + the memory product), business model, current engineering status. Tells you *why*.
2. `README.md` — Engineering setup, env vars, project structure, operational runbook. Tells you *how to run it*.
3. `TODO.md` — Prioritized backlog with file paths and acceptance criteria. Tells you *what to do*.
4. **This file** — Project conventions, design-system reminder, available skills.
5. `DESIGN.md` — Design tokens. **Read before any UI change.**

The sister product (`/Users/abhinavramesh/autonomous-memory/apps/rowboat`) has its own `HANDOFF.md` and `TODO.md` — switch directories before working there.

## Project
AI-powered platform that enables companies to run their entire business with AI agents for every workflow: Sales, Marketing, Accounting, Strategy, Product Development, Engineering (front-end & back-end), Product Management, and AI expertise. Users enter their company website, get recommended agents, and communicate with them via WhatsApp. Agents default to Claude Sonnet 4.6 but users can bring their own models.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## gstack
Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

### Available skills
- /office-hours — YC-style brainstorming and idea validation
- /plan-ceo-review — CEO/founder strategy review
- /plan-eng-review — Engineering architecture review
- /plan-design-review — Design plan review
- /design-consultation — Design system creation
- /review — Pre-landing PR review
- /ship — Ship workflow (test, review, commit, push, PR)
- /browse — Fast headless browser for QA and testing
- /qa — QA test and fix bugs
- /qa-only — QA report only (no fixes)
- /design-review — Visual design audit and fixes
- /setup-browser-cookies — Import browser cookies for auth testing
- /retro — Weekly engineering retrospective
- /investigate — Systematic debugging
- /document-release — Post-ship documentation update
- /codex — OpenAI Codex second opinion
- /careful — Safety guardrails for destructive commands
- /freeze — Restrict edits to a directory
- /guard — Full safety mode
- /unfreeze — Remove edit restrictions
- /gstack-upgrade — Upgrade gstack to latest

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

---

## Vertical packs (live demos · 2026-05-07)

Two production-shaped client demos live in this repo. Treat them as the canonical examples of how a vertical-on-The-Autonomous looks.

### Client 1 — Telegram timesheet reminders (JAA Associates)
- **Domain:** `src/lib/timesheets.ts`, `src/lib/reminder-schedule.ts`
- **Routes:** `src/app/api/timesheets/{employees,run-pass,mark-submitted,reset-submission,schedule}` + `src/app/api/cron/timesheet-reminders` + `src/app/api/messaging/telegram`
- **Migrations:** `005_timesheets.sql` (employees + submissions), `006_reminder_schedule.sql` (cron schedule per firm)
- **UI:** `src/app/admin/timesheets/page.tsx` + `_components/{timesheet-actions,schedule-card,row-actions,mark-submitted-button}.tsx`
- **Test bot:** `@timesheettrial_bot`. Webhook handler at `src/app/api/messaging/telegram/route.ts` handles `/start`, `/link <email>`, `DONE`, `HELP` keywords before falling through to agent routing.
- **Cron:** `0 17 * * *` Asia/Kolkata default; honored by the cron route via `getSchedule()`.

### Client 2 — Shopify prompt-edit agent (getsoma.store / `zizrev-ej.myshopify.com`)
- **Domain:** `src/lib/shopify.ts` (Admin API client + token cache), `src/lib/shopify-planner.ts` (Claude tool-use loop), `src/lib/shopify-apply.ts` (sequential mutator), `src/lib/shopify-insights.ts` (category-aware competitor analysis)
- **Routes:** `src/app/api/shopify/{plan,apply,insights}/route.ts`
- **UI:** `src/app/admin/shopify/page.tsx` + `_components/{shopify-editor,insights-panel}.tsx`
- **Auth:** Shopify deprecated static `shpat_…` tokens in 2026 — we use the **client credentials grant** to mint fresh 24h tokens. Cached in-process via `getAccessToken()` with 5-minute refresh buffer.

### Shared admin UI primitives (built this session)
- `src/app/admin/_components/toast.tsx` — `<ToastProvider>` mounted in admin layout; `useToast()` hook anywhere
- `src/app/admin/_components/send-burst.tsx` — celebratory centered overlay; `useSendBurst()` returns `fire(payload)` + the portal node
- Animations in `globals.css`: `admin-cta-idle`, `admin-cta-progress`, `admin-cta-icon-sparkle`, `admin-cta-icon-nudge`, `admin-spinner`, `admin-toast-{in,out}`, `admin-row-flash`, `admin-row-remove`, `admin-burst-*`

## Helper scripts (commitable, no secrets)

```bash
bun run scripts/init-base-schema.ts         # bootstrap base tables on a fresh DB
bun run scripts/shopify-smoke.ts            # token + product read
bun run scripts/shopify-tags.ts             # print current tags (verify mutations)
bun run scripts/shopify-e2e.ts              # full plan → apply → rollback
bun run scripts/shopify-insights-test.ts    # live Claude insights run
bun run scripts/timesheet-e2e.ts            # roster + cron pass dry-run
bun run scripts/telegram-webhook-e2e.ts     # simulate inbound /link, DONE, HELP
```

## Demo-state DB convention

The dev Supabase project (`znmerxpukimtugwtfysy`) is set up so:
- The Clerk user `user_3BExSeHrlQ7fclyuKyp9t4JBdoo` (Abhinav) owns one workspace company
- That company has Girish (`girish@jaa-associates.com`) on the timesheet roster, period `2026-W19` outstanding
- A reminder schedule (Daily 17:00 IST) is configured

To re-seed after a wipe: re-run `scripts/init-base-schema.ts`, then `psql -f` migrations 001–006, then the seed inserts in `HANDOFF.md`.

## Conventions worth knowing

- **No new dependencies casually** — admin uses hand-rolled SVG icons + CSS keyframes. No framer-motion, no lucide-react, no headlessui.
- **Mock fallback pattern** — every DB read in admin tries Postgres, catches, returns mock fixture. UI works without `DATABASE_URL`.
- **Tenant isolation** — `resolveTenant()` for /admin pages; tenant-scoped queries by `company_id`. Migrations 001+ also enforce RLS.
- **Service worker disabled in dev** (`pwa-register.tsx`) — auto-unregisters any leftover worker on `localhost`. Stops bundle-cache pain.
- **Browser extension errors filtered** — `src/app/layout.tsx` swallows `chrome-extension://` errors so MetaMask et al don't pollute the Next dev overlay.
- **Both verticals are single-tenant in v1** — `SHOPIFY_*` and `TELEGRAM_BOT_TOKEN` are global env vars. Move to per-firm `integrations` rows when onboarding the second merchant.
