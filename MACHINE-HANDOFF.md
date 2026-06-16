# MACHINE-HANDOFF — Continuing this project on another computer

This doc tells a coding agent (or human) how to pick up **TheAutonomous.org** on a fresh
machine and keep building. It is committed and **contains no secrets**.

> For project *context* (architecture, module map, DB seed inserts, run details), see
> [`HANDOFF.md`](./HANDOFF.md) and the read-order in [`CLAUDE.md`](./CLAUDE.md). This file
> only covers the cross-machine transfer.

Stack: Next.js 16 + React 19 + TypeScript · package manager **bun** · Clerk auth ·
cloud Supabase (Postgres) backend. **The GitHub repo is PUBLIC — never commit secrets or
the `marketing-ops/` data.**

---

## What git does NOT carry over

Three things live outside git and must be transferred **out-of-band** (AirDrop, encrypted
bundle, or a secrets manager) — never committed, because the repo is public:

| Item | Path (repo root) | Why it's not in git |
|------|------------------|---------------------|
| Secrets | `.env.local` | gitignored — live API keys & DB URL |
| Marketing data | `marketing-ops/` | untracked — contains lead data / PII |
| Cold-sequence doc | `the-autonomous-cold-sequence.md` | untracked working doc |

---

## Step 0 — Get the repo

```bash
git clone https://github.com/matterhornso/theautonomousorg.git
cd theautonomousorg
git checkout chore/clerk-security-bump   # active in-progress branch; `main` is stable
git pull
```
Already cloned? `git fetch && git checkout chore/clerk-security-bump && git pull`

## Step 1 — Place the 3 out-of-band files

Drop the transferred items into the repo **root** (the folder with `package.json`) so the
layout is:
```
theautonomousorg/.env.local                      # dotfile — Cmd+Shift+. to see it in Finder
theautonomousorg/marketing-ops/
theautonomousorg/the-autonomous-cold-sequence.md
```
Confirm `.env.local` sits next to `.env.example`. Then verify they are **not** staged:
```bash
git status   # .env.local ignored; marketing-ops/ + the cold-sequence doc show as untracked
```
**Never `git add` `.env.local` or `marketing-ops/`** — the repo is public.

## Step 2 — Onboard (read in this order, before writing code)

1. `CONTEXT.md` — why the platform exists, business model, eng status
2. `README.md` — setup, env vars, project structure, runbook
3. `TODO.md` — prioritized backlog with file paths + acceptance criteria
4. `CLAUDE.md` — conventions, design-system pointer, available skills
5. `DESIGN.md` — design tokens (**read before any UI change**)

Also skim `HANDOFF.md` (full project context) and `UNIFICATION.md` (in-flight effort to
fold the sister "memory" product into this app).

## Step 3 — Install + verify environment

```bash
bun install
bun dev          # dev server, http://localhost:3000
bun run test     # vitest
```
`.env.local` must contain these keys (values supplied out-of-band — do **not** invent them):

```
ANTHROPIC_API_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL   NEXT_PUBLIC_CLERK_SIGN_UP_URL   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
DATABASE_URL
ENCRYPTION_KEY
RESEND_API_KEY
SHOPIFY_STORE_DOMAIN   SHOPIFY_CLIENT_ID   SHOPIFY_CLIENT_SECRET   SHOPIFY_API_VERSION
TELEGRAM_BOT_TOKEN   TELEGRAM_WEBHOOK_SECRET
CRON_SECRET
BROADCAST_ADMIN_CODE   BROADCAST_COMPANY_ID
```
If any are missing, **stop and list which** rather than guessing.

The Supabase DB is **cloud-hosted and shared** — it already holds seeded demo state (see
"Demo-state DB convention" in `CLAUDE.md`). **Do not re-seed or wipe it.** Optional live
smoke tests:
```bash
bun run scripts/shopify-smoke.ts
bun run scripts/timesheet-e2e.ts
bun run scripts/telegram-webhook-e2e.ts
```

## Step 4 — Continue building

Boot the dev server clean, then take the top item from `TODO.md`. **Announce the task and
your plan before starting.** Work on `chore/clerk-security-bump` or a feature branch off
it — **never push to `main`** — and open a PR with conventional-commit messages.

### Constraints (from `CLAUDE.md`)
- **No casual new dependencies** — admin UI uses hand-rolled SVG icons + CSS keyframes
  (no framer-motion, lucide-react, headlessui).
- **Mock-fallback pattern** — every admin DB read tries Postgres, catches, returns a mock
  fixture (UI works without `DATABASE_URL`).
- **Tenant isolation** — `resolveTenant()` / `company_id` scoping; migrations enforce RLS.
- **Read `DESIGN.md` before any visual change**; flag anything that deviates.

---

## Handoff checklist

- [ ] Repo cloned, on `chore/clerk-security-bump`, `git pull` clean
- [ ] `.env.local`, `marketing-ops/`, `the-autonomous-cold-sequence.md` placed in repo root
- [ ] `git status` shows none of the above staged
- [ ] `bun install` succeeds
- [ ] `bun dev` boots clean on :3000
- [ ] Read CONTEXT → README → TODO → CLAUDE → DESIGN
- [ ] Next task identified from `TODO.md`
