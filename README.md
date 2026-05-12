# The Autonomous

**AI agents for every role in your company.** Enter your website, get recommended agents, and start automating your workflows — Sales, Marketing, Accounting, Strategy, Product, Engineering, HR, Legal, Finance, and more.

Built by [Chainflux](https://chainflux.io). Live at [theautonomous.org](https://theautonomous.org).

---

## 🤖 Coding Agent Quickstart

If you're an AI coding agent picking up work on this repo, read these files **in this order**:

1. **`CONTEXT.md`** — Platform context, ecosystem map (this app + the memory product), business model, current engineering status. Tells you *why* before *what*.
2. **`README.md`** (this file) — Engineering setup, env vars, project structure, operational runbook.
3. **`TODO.md`** — Prioritized backlog with file paths, success criteria, and what blocks each item. Pick the highest unchecked P0 not blocked by user input.
4. **`CLAUDE.md`** — Project conventions, available skills, design-system reminder.
5. **`DESIGN.md`** — Design tokens (fonts, colors, spacing). **Read before any UI change.**

After reading, run `curl http://localhost:3000/api/health` to confirm the local environment is healthy before changing code. If `database` is `FAILED`, the Supabase project may have auto-paused — see *Operational Runbook → Database: Supabase pause/restore* below.

The sister product (`autonomous-memory/apps/rowboat` — the memory app) has its own `HANDOFF.md` + `TODO.md`. Don't edit it from this repo; switch directories first.

---

## Table of Contents

1. [Two Ways to Use The Autonomous](#two-ways-to-use-the-autonomous)
2. [Quick Start (Local Setup)](#quick-start-local-setup)
3. [The Autonomous Org Ecosystem](#the-autonomous-org-ecosystem)
4. [Using TA in Your IDE](#using-ta-in-your-ide)
5. [What is The Autonomous?](#what-is-the-autonomous)
6. [Environment Variables](#environment-variables)
7. [Operational Runbook](#operational-runbook)
8. [Tech Stack & Architecture](#tech-stack--architecture)
9. [Project Structure](#project-structure)
10. [Use with Claude Code (Prompt-Only Version)](#use-with-claude-code-prompt-only-version)
11. [Development](#development)

---

## Two Ways to Use The Autonomous

### Option 1: Use the Website (Recommended for most businesses)

Visit [theautonomous.org](https://theautonomous.org) and enter your company website. We'll analyze your business and recommend which AI agents would have the highest impact. No technical knowledge needed — just sign up, pick your agents, and start chatting with them from the dashboard, WhatsApp, or Telegram.

**Best for:** SMBs and teams who want AI agents working for them without any setup.

### Option 2: Run Locally in Your IDE (For developers and AI-native teams)

If you're comfortable with code and want full control, you can clone this repo and run the entire platform locally. Works with any AI-enabled IDE — Claude Code, Cursor, Windsurf, VS Code with Copilot, or any editor.

**Best for:** Developers, technical founders, and teams who want to customize agents, add integrations, or self-host.

---

## Quick Start (Local Setup)

### Prerequisites

- [Node.js 20+](https://nodejs.org/) (Node 22 LTS recommended; Node 25 has experimental webstorage warnings)
- An [Anthropic API key](https://console.anthropic.com/) (powers the AI agents)
- Optional: [Clerk](https://clerk.com) account for auth (keyless dev mode works without one)

### 1. Clone and install

```bash
git clone https://github.com/matterhornso/theautonomousorg.git
cd theautonomousorg
npm install
```

### 2. Set up your environment

Create `.env.local` in the repo root. Minimum required:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

For full functionality see [Environment Variables](#environment-variables).

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter any company URL and the platform handles the rest.

### 4. Sanity-check the install

```bash
curl http://localhost:3000/api/health | jq
```

Expected output (when DB is reachable):

```json
{
  "status": "healthy",
  "checks": {
    "ANTHROPIC_API_KEY": "set",
    "DATABASE_URL": "set",
    "CLERK_SECRET_KEY": "set",
    "ENCRYPTION_KEY": "set",
    "database": "connected"
  }
}
```

If `database` shows `"FAILED: Tenant or user not found"`, the Supabase project is paused — see [Operational Runbook](#operational-runbook).

### 5. Run tests (optional)

```bash
npm test         # Vitest test suite
npm run test:watch
```

---

## The Autonomous Org Ecosystem

This repo (`theautonomousorg`) is the **marketing site + main app** for The Autonomous. It is one of two repos in the ecosystem:

| Repo | Path | URL | What it is |
|------|------|-----|------------|
| `theautonomousorg` | `/Users/abhinavramesh/theautonomousorg` | [theautonomous.org](https://theautonomous.org) | Marketing site + agent platform (this repo) |
| `autonomous-memory` | `/Users/abhinavramesh/autonomous-memory` | memory.theautonomous.org (planned) | Persistent memory/knowledge-graph product, includes the `apps/rowboat` fork |

### About the Rowboat Fork

`autonomous-memory/apps/rowboat` is a fork of [rowboat](https://github.com/rowboatlabs/rowboat) — an open-source agent builder — customized for our memory product. The fork's purpose:

- **Voice pipeline:** record meeting → Deepgram transcription → entity extraction → MongoDB knowledge graph
- **Pre-meeting briefs:** query the knowledge graph + Claude synthesis
- **Reuses Clerk auth** from this repo (shared user identity across both products)

Status as of 2026-04-28: the fork builds but is **not deployed** and requires significant infra (MongoDB, Redis, Clerk, Anthropic, OpenAI, Deepgram, S3, Stripe). See `TODO.md` for the setup checklist.

---

## Using TA in Your IDE

### With Claude Code

Open the project folder in Claude Code. The `CLAUDE.md` file at the root gives Claude full context about the project — architecture, conventions, available skills, and design system. Claude will understand the entire codebase and can:

- Add new agent roles with custom skills
- Build new MCP integrations (connect to any API)
- Modify agent prompts and behavior
- Create new dashboard pages
- Add new API endpoints

**Example prompts:**

```
"Add a new agent role for Customer Support with Intercom and Zendesk integrations"
"Create a webhook that triggers the Sales agent when a new lead comes in from HubSpot"
"Add a scheduled task that makes the Marketing agent post to social media every Monday"
```

### With Cursor / Windsurf / Other AI IDEs

Open the project folder. These IDEs will read the codebase structure. Key files to point them to:

| File | What it does |
|------|-------------|
| `CLAUDE.md` | Project conventions and architecture overview |
| `DESIGN.md` | Design system (fonts, colors, spacing) — **always read before UI changes** |
| `TODO.md` | Active backlog — read first to see what's outstanding |
| `src/app/data.ts` | All 15 agent role definitions (skills, connectors, starters) |
| `src/lib/prompts.ts` | How agent system prompts are built |
| `src/lib/mcp/registry.ts` | Tool registry — what each agent can do |
| `src/lib/task-templates.ts` | Proactive tasks that agents auto-execute |
| `src/lib/db.ts` | Database abstraction (SQLite ↔ Postgres switching layer) |
| `src/lib/db-postgres.ts` / `src/lib/db-sqlite.ts` | Concrete DB implementations |

### Adding a New Agent Role

1. Add the role definition to `src/app/data.ts` (icon, skills, connectors, starters)
2. Add role instructions to `src/lib/prompts.ts` (how the agent should behave)
3. Add a toolkit to `src/lib/mcp/registry.ts` (tools and capabilities)
4. Add task templates to `src/lib/task-templates.ts` (proactive work)
5. Add an icon to `src/app/components/agent-icons.tsx`
6. Update tests if needed (`npm test`)

### Adding an MCP Integration

1. Create a new file in `src/lib/mcp/` (see `apollo.ts` as a reference)
2. Define Claude tool schemas (name, description, input_schema)
3. Implement the executor function that calls the external API
4. Register the tools in `src/lib/mcp/registry.ts`
5. Wire into `src/app/api/chat/route.ts` tool selection
6. Add an integration entry in `src/lib/suggested-platforms.ts` if user-facing

---

## What is The Autonomous?

The Autonomous gives you an AI workforce that actually works. Not chatbots — **teammates.**

1. **Enter your website** — our AI analyzes your business
2. **Get agent recommendations** — we tell you which agents would have the highest impact
3. **Launch your agents** — each one comes with role-specific skills, tools, and company context
4. **Your agents start working** — proactive tasks run automatically (ICP research, SEO audits, competitive analysis)
5. **Chat with them** — via the dashboard, WhatsApp, or Telegram

Each agent runs in its own isolated instance with persistent memory, role-specific MCP connectors (Apollo.io, Instantly.ai, etc.), and the ability to collaborate with other agents via @mentions.

### 15 Agent Roles

| Role | What it does | Key tools |
|------|-------------|-----------|
| **Sales** | Prospect research, outbound sequences, pipeline management | Apollo.io, Instantly.ai |
| **Marketing** | SEO, content creation, social media, campaign management | Instantly.ai, Web Search |
| **Accounting** | Financial reporting, bookkeeping, tax compliance | QuickBooks, Xero |
| **Strategy** | Competitive analysis, market research, OKRs | Apollo.io, Web Search |
| **Product** | PRDs, user research, roadmap planning | Linear, Jira |
| **Front-End Engineering** | React/Next.js, accessibility, performance | GitHub, Vercel |
| **Back-End Engineering** | API design, databases, security, infrastructure | GitHub, AWS |
| **AI Expert** | Model selection, prompt engineering, RAG pipelines | Anthropic, OpenAI |
| **Admin** | Contracts, vendor management, document management | DocuSign, Google Workspace |
| **HR** | Recruiting, onboarding, performance reviews | Greenhouse, BambooHR |
| **Finance** | Financial modeling, fundraising, investor reporting | Stripe, Brex |
| **Customer Success** | Health scoring, churn prevention, onboarding | Intercom, Zendesk |
| **Legal** | Contract review, compliance, IP protection | DocuSign |
| **Data Analyst** | Dashboards, cohort analysis, A/B testing | Mixpanel, Google Analytics |
| **CEO** | Executive oversight, cross-agent queries, board reporting | All agents |

---

## Environment Variables

### Main App (`theautonomousorg`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Powers all AI agent conversations (Claude Sonnet 4.6 default) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Recommended | Clerk auth client-side (keyless mode works without) |
| `CLERK_SECRET_KEY` | Recommended | Clerk auth server-side |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | Defaults to `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | Defaults to `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | No | Where to send users after sign-up |
| `DATABASE_URL` | Recommended for prod | Postgres connection string (Supabase). Without it, falls back to SQLite at `data/autonomous.db` |
| `ENCRYPTION_KEY` | Yes (if BYOK enabled) | 32-byte hex key for AES-256-GCM at-rest encryption of user API keys |
| `RESEND_API_KEY` | No | Enables email delivery for newsletter, contact form, team invites |
| `STRIPE_SECRET_KEY` | No | Enables billing (free tier works without) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature verification |
| `APOLLO_API_KEY` | No | Enables Apollo.io prospect search for Sales/Strategy |
| `INSTANTLY_API_KEY` | No | Enables Instantly.ai email campaigns for Sales/Marketing |
| `TELEGRAM_BOT_TOKEN` | For timesheets | Bot token from `@BotFather`. Used by Telegram messaging bridge AND the JAA timesheet reminder vertical. |
| `TELEGRAM_WEBHOOK_SECRET` | For timesheets | `openssl rand -hex 32`. Verified in `x-telegram-bot-api-secret-token` header on every inbound update. Paste the same value into Telegram's `setWebhook` call. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | No | WhatsApp messaging |
| `SHOPIFY_STORE_DOMAIN` | For Shopify Editor | The merchant's `<handle>.myshopify.com` (NOT their public custom domain). |
| `SHOPIFY_CLIENT_ID` | For Shopify Editor | From the merchant's Dev Dashboard custom app. We exchange Client ID + Secret for a 24h `shpat_…` access token via the [client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant). |
| `SHOPIFY_CLIENT_SECRET` | For Shopify Editor | Same source. Treat like a password. |
| `SHOPIFY_API_VERSION` | No | Defaults to `2026-04`. Use whatever version Shopify's Dev Dashboard suggests for your app. |
| `CRON_SECRET` | For prod cron | `openssl rand -hex 32`. Token-gate for `/api/cron/*` endpoints. Pass as `?token=<value>` or `Authorization: Bearer <value>`. |

Generate a fresh `ENCRYPTION_KEY` with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Demo verticals: helper scripts

Live verifiers shipped with the repo. They exercise the full code path against real services — no mocks. Run from project root:

```bash
# Bootstrap base tables on a fresh DB (idempotent)
DATABASE_URL='postgresql://…' bun run scripts/init-base-schema.ts

# Shopify
bun run scripts/shopify-smoke.ts            # token + first 5 products
bun run scripts/shopify-tags.ts             # print current tags on Soma Sparkling Water
bun run scripts/shopify-e2e.ts              # plan → apply → verify → rollback → verify clean
bun run scripts/shopify-insights-test.ts    # Claude category-aware insights against the live catalog

# Timesheets / Telegram
bun run scripts/timesheet-e2e.ts            # roster + cron pass dry-run
bun run scripts/telegram-webhook-e2e.ts     # simulate /link, DONE, HELP against the live route
```

### Supabase connection note (IPv6 vs pooler)

The "Direct connection" string Supabase shows on the Connection Strings page resolves to **IPv6 only**. Many home / corporate networks don't have IPv4-translated IPv6 paths, so `psql` against the direct host will fail with `No route to host`. **Use the Session Pooler URL instead** (port `5432`, host `aws-<region>.pooler.supabase.com`, username `postgres.<project-ref>`). It supports DDL fine and works on IPv4. The Transaction Pooler (port 6543) is what `.env.local`'s `DATABASE_URL` points to for runtime; both are fine on the same DB.

### Rowboat Fork (`autonomous-memory/apps/rowboat`)

See `apps/rowboat/.env.example`. Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Yes | Clerk auth (share with main app for SSO) |
| `USE_AUTH` | Yes | Set to `true` to enable Clerk; `false` for unauthenticated dev |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string (knowledge graph + sessions) |
| `REDIS_URL` | Yes | Redis (queues, cache) — Upstash recommended |
| `ANTHROPIC_API_KEY` | Yes | Claude for entity extraction + synthesis |
| `OPENAI_API_KEY` | Yes | OpenAI-compatible endpoint for rowboat agent runtime |
| `OPENAI_BASE_URL` | No | Defaults to `https://api.openai.com/v1` |
| `DEEPGRAM_API_KEY` | Yes | Voice transcription |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` | Yes | Audio file storage |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Billing |
| `STRIPE_PRICE_EARLY_ACCESS` / `STRIPE_PRICE_EXECUTIVE` | Yes | Stripe price IDs |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL (e.g. `https://memory.theautonomous.org`) |

---

## Operational Runbook

### Database: Supabase pause/restore

**Symptom:** `/api/health` returns `503` with `"database": "FAILED: Tenant or user not found"` even though `DATABASE_URL` is set.

**Cause:** Supabase free-tier projects pause after 7 days of inactivity. The pooler returns "Tenant or user not found" because the project is in `INACTIVE` state.

**Fix:**

1. Go to [Supabase dashboard](https://supabase.com/dashboard) → select project `matterhornso's Project` (ref: `hobjxomvmxradkgnivol`).
2. Click **Restore project**. Takes ~2 minutes to come back to `ACTIVE_HEALTHY`.
3. Re-run `curl http://localhost:3000/api/health` to confirm.

Alternatively, via Claude Code with the Supabase MCP:
```
"Restore Supabase project hobjxomvmxradkgnivol"
```

**Prevention:** upgrade to Supabase Pro ($25/mo) — projects never pause.

### Local SQLite mode

If `DATABASE_URL` is not set, the app uses SQLite at `data/autonomous.db`. The schema is auto-created on first write. To reset local data:

```bash
rm -rf data/autonomous.db data/autonomous.db-shm data/autonomous.db-wal
```

### Postgres schema migration

Schema is in `src/lib/db-postgres.ts` (`initSchema()`). On Railway, the schema is created on first deploy. To force re-init:

```bash
npm run init:postgres   # if script exists; otherwise:
npx tsx scripts/init-postgres.ts
```

To migrate schema between versions: `npx tsx scripts/migrate-postgres.ts`. To sync schema with the SQLite source of truth: `npx tsx scripts/sync-postgres-schema.ts`.

### Railway deploy

Production runs on Railway. Two services:

1. **Web** — `npm run build && npm start`. Routes user traffic.
2. **Worker** — `npx tsx src/worker.ts`. Processes the task queue (proactive agent work, scheduled tasks, debriefs). Without this, queued tasks sit forever.

Both services need the same env vars. To deploy:

```bash
git push origin main
# Railway auto-deploys on push
```

For persistent SQLite data on Railway, mount a volume at `/app/data`. Without a volume (and without `DATABASE_URL`), SQLite is reset every deploy.

### Health check endpoint

`GET /api/health` returns:
- `200` with `{"status": "healthy"}` when all checks pass
- `503` with `{"status": "degraded"}` and per-check failure details otherwise

Use this for uptime monitoring (UptimeRobot, BetterStack, etc.).

### Common errors

| Error | Likely cause | Fix |
|-------|-------------|-----|
| `database: "FAILED: Tenant or user not found"` | Supabase project paused | Restore via dashboard |
| `database: "FAILED: connect ETIMEDOUT"` | Network/firewall | Check pooler URL, verify VPC allowlist |
| Clerk shows "Development mode" badge | Using `pk_test_*` / `sk_test_*` keys | Swap to `pk_live_*` / `sk_live_*` in env |
| Rowboat 500 with `framer-motion not found` | Peer dep missing | `cd apps/rowboat && npm install framer-motion --legacy-peer-deps` |
| Rowboat 500 with `localStorage.getItem is not a function` | Node 25 + Clerk keyless mode interaction during SSR | Use Node 22 LTS, or set proper Clerk keys (not keyless) |

---

## Tech Stack & Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes, SSE streaming |
| AI | Anthropic Claude Sonnet 4.6 (default), `@anthropic-ai/sdk` |
| Database (dev) | SQLite via `better-sqlite3` |
| Database (prod) | Postgres via `postgres` (Supabase) |
| Auth | Clerk (`@clerk/nextjs`) — keyless mode for dev |
| Email | Resend |
| Billing | Stripe (optional) |
| Cron | `croner` (in-process scheduling) |
| Testing | Vitest, Testing Library, jsdom |
| E2E | Playwright |
| Worker | Standalone Node process (`src/worker.ts`) on Railway |

### Architecture Diagram

```
User → Landing Page → URL Analysis (Claude) → Agent Recommendations
                                                    ↓
                                           Select & Provision Agents
                                                    ↓
                              ┌──────────────────────────────────────┐
                              │         Agent Orchestrator            │
                              │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
                              │  │Sales│ │Mktg │ │Strat│ │ CEO │  │
                              │  │Agent│ │Agent│ │Agent│ │Agent│  │
                              │  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘  │
                              │     │       │       │       │      │
                              │  ┌──▼───────▼───────▼───────▼──┐  │
                              │  │    Inter-Agent Relay (@)     │  │
                              │  └─────────────────────────────┘  │
                              └──────────┬───────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                Dashboard          Telegram Bot         WhatsApp
                (streaming)       (webhook)            (Twilio)
```

### Key Features

- **15 Agent Roles** — Each with role-specific skills, tools, and proactive tasks
- **Proactive Tasks** — Agents auto-execute work on provision (ICP research, SEO audit, competitive analysis)
- **Inter-Agent Communication** — @mentions route messages between agents
- **CEO Agent** — Queries all agents, aggregates company metrics, produces executive reports
- **Persistent Memory** — Agents remember context across conversations
- **Cron Jobs** — Schedule recurring tasks (weekly reports, daily audits)
- **Team Access** — Multiple users connect to the same agents (owner/admin/member/viewer roles)
- **Daily Debriefs** — 10am summary of all agent activity
- **Integrations Hub** — 50+ tools across all roles with password-encrypted API key storage (AES-256-GCM)
- **BYOK / BYOM** — Bring your own API keys for 25+ services, bring your own model (any OpenAI-compatible endpoint)
- **File Uploads** — Upload invoices, resumes, reports for agents to process
- **Webhooks** — Trigger agent tasks from external tools (HMAC-signed)
- **Self-Serve API** — REST API with Bearer token auth (`/api/v1/agents`, `/api/v1/chat`, `/api/v1/tasks`)
- **TA Credits** — 1,000 free credits on signup, 50 per prompt, $19 per 1,000 additional
- **Analytics Dashboard** — Task completion rates, per-agent performance
- **Custom Agent Builder** — Create agents with custom roles, skills, and model selection
- **Agent Status Page** — View each agent's memory, skills, tasks, actions, and connected services

---

## Project Structure

```
theautonomousorg/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/           # Website analysis engine
│   │   │   ├── chat/              # Streaming chat with tool use
│   │   │   ├── provision/         # Agent provisioning + task enqueuing
│   │   │   ├── tasks/             # Task processor + scheduler
│   │   │   ├── agents/            # Status, relay, custom agents, skills
│   │   │   ├── billing/           # Stripe checkout, webhooks, portal
│   │   │   ├── credits/           # Credits balance + transactions
│   │   │   ├── team/              # Team members + agent assignments
│   │   │   ├── upload/            # File upload + serve
│   │   │   ├── webhooks/          # Webhook management + receiver
│   │   │   ├── debrief/           # Daily debrief generation
│   │   │   ├── user-keys/         # BYOK API key storage
│   │   │   ├── keys/              # TA API key management
│   │   │   ├── messaging/telegram/ # Telegram webhook
│   │   │   ├── v1/                # Self-serve REST API
│   │   │   ├── connectors/        # Apollo et al. connector configs
│   │   │   ├── evals/             # Agent eval runs + feedback
│   │   │   ├── contact/           # Contact form (Resend)
│   │   │   ├── newsletter/        # Newsletter signup (Resend)
│   │   │   ├── health/            # Health check endpoint
│   │   │   └── profile/           # User profile
│   │   ├── components/
│   │   │   ├── dashboard/         # Dashboard client + chat UI
│   │   │   ├── navbar.tsx         # Site nav
│   │   │   └── agent-icons.tsx    # SVG icons for each role
│   │   ├── dashboard/[companyId]/
│   │   │   ├── page.tsx           # Agent dashboard + chat
│   │   │   ├── agents/            # Agent status overview
│   │   │   ├── analytics/         # Performance analytics
│   │   │   ├── builder/           # Custom agent builder
│   │   │   ├── schedule/          # Cron job scheduling
│   │   │   ├── team/              # Team management
│   │   │   ├── skills/            # Skills showcase
│   │   │   ├── debrief/           # Daily debrief
│   │   │   ├── telegram/          # Telegram bot setup
│   │   │   ├── integrations/      # 50+ tools with encrypted key storage
│   │   │   └── settings/          # API keys + BYOK connectors
│   │   ├── blog/                  # Blog posts
│   │   ├── memory/                # Memory product placeholder
│   │   ├── onboarding/            # 5-step onboarding wizard
│   │   ├── provisioning/          # Agent spawning animation
│   │   ├── sign-in/ / sign-up/    # Clerk routes
│   │   ├── contact/ / privacy/ / terms/
│   │   ├── sitemap.ts
│   │   └── data.ts                # Agent role definitions
│   ├── lib/
│   │   ├── db.ts                  # DB abstraction (auto-routes to SQLite or Postgres)
│   │   ├── db-sqlite.ts           # SQLite implementation (source of truth for schema)
│   │   ├── db-postgres.ts         # Postgres implementation
│   │   ├── prompts.ts             # System prompt builder
│   │   ├── task-processor.ts      # Shared task execution logic
│   │   ├── task-templates.ts      # Proactive task prompts per role
│   │   ├── auth-helpers.ts        # Company ownership validation
│   │   ├── api-auth.ts            # API key Bearer auth
│   │   ├── api-keys.ts            # API key generation
│   │   ├── suggested-platforms.ts # 25+ BYOK platform definitions
│   │   ├── debrief.ts             # Debrief generation
│   │   ├── chai-time.ts           # Daily check-in feature
│   │   ├── eval-judge.ts          # Eval scoring
│   │   ├── eval-test-suites.ts    # Eval test definitions
│   │   ├── agent-templates.ts     # Pre-built agent presets
│   │   ├── stripe.ts              # Stripe client + helpers
│   │   ├── email.ts               # Resend client
│   │   ├── telegram.ts            # Telegram bot helpers
│   │   ├── rate-limit.ts          # In-memory rate limiting
│   │   ├── validation.ts          # Input validation
│   │   ├── types.ts               # Shared types
│   │   └── mcp/
│   │       ├── registry.ts        # Tool registry (15 roles × tools)
│   │       ├── apollo.ts          # Apollo.io integration
│   │       ├── instantly.ts       # Instantly.ai integration
│   │       ├── web-search.ts      # Web search + URL fetch
│   │       └── ceo-tools.ts       # CEO cross-agent queries
│   ├── proxy.ts                   # Clerk auth middleware
│   └── worker.ts                  # Background task worker (Railway)
├── scripts/
│   ├── init-postgres.ts           # Create Postgres schema
│   ├── migrate-postgres.ts        # Migrate Postgres schema
│   └── sync-postgres-schema.ts    # Sync schema from SQLite source
├── data/                          # SQLite DB (gitignored, mounted as Railway volume)
├── public/                        # Static assets, OG images, PWA icons
├── CLAUDE.md                      # Project conventions for Claude Code
├── DESIGN.md                      # Design system (read before any UI change)
├── TODO.md                        # Active backlog
├── README.md                      # This file
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## Use with Claude Code (Prompt-Only Version)

**Don't want to run the full platform?** You can spawn AI agents directly in Claude Code by pasting this prompt. It creates the same agent team with the same skills and methodology — no server needed.

### One-Prompt Agent Spawner

Copy and paste this into Claude Code:

```
You are The Autonomous — an AI workforce platform. I want you to act as a team of AI agents for my company.

## My Company
[Enter your company name, website, industry, and what you do here]

## Agents to Spawn
Based on my company, create and act as the following agents. For each agent, maintain a separate context and personality. When I address an agent by name (e.g., "Hey Sales" or "@Marketing"), respond as that agent with its specific expertise.

### Sales Agent
You are an expert Sales agent. Your methodology:
- Research prospects using BANT (Budget, Authority, Need, Timeline)
- Write personalized outreach sequences, not templates
- Track pipeline with stages, next steps, and close dates
- Weekly pipeline health reports with conversion rates
Skills: ICP definition, prospect research, cold email writing, pipeline forecasting, multi-channel outreach, competitive battle cards, meeting scheduling, CRM data hygiene

### Marketing Agent
You are an expert Marketing agent. Your approach:
- Strategy first, execution second — every campaign ties to a business objective
- Content should be genuinely useful, not keyword-stuffed
- Measure everything: CAC, conversion rates, engagement, attribution
Skills: SEO keyword research, blog post writing, social media calendars, email newsletters, landing page copy, brand voice, campaign analytics

### Strategy Agent
You are an expert Strategy agent. Your framework:
- Start with data, not opinions
- Think in frameworks: SWOT, Porter's Five Forces, TAM/SAM/SOM
- Challenge assumptions — the most valuable work is saying "wait, are we sure?"
Skills: Competitive mapping, market sizing, business model canvas, OKR definition, go-to-market strategy, board decks

### Product Agent
You are an expert Product agent. Your principles:
- User problems first, solutions second
- Prioritize ruthlessly — say no to most things
- Write clear PRDs with problem statements, success metrics, scope, non-goals
Skills: PRD writing, user personas, feature prioritization (RICE), sprint planning, user story writing, roadmap creation

### Accounting Agent
You are an expert Accounting agent. Your standards:
- Accuracy is non-negotiable
- Track cash flow weekly, forecast monthly
- Flag anomalies proactively
Skills: Chart of accounts, monthly close, cash flow forecasting, expense categorization, tax calendar, financial reports

### HR Agent
You are an expert HR agent. Your approach:
- Recruiting is a pipeline — treat it with sales rigor
- Onboarding should make new hires productive in week 1
Skills: Job descriptions, candidate screening, structured interviews, 30/60/90 onboarding, performance reviews, compensation benchmarking

### Finance Agent
You are an expert Finance agent. Your framework:
- Financial models should tell a story, not just show numbers
- Unit economics drive every growth recommendation
Skills: 3-statement modeling, fundraising strategy, investor updates, unit economics (CAC/LTV), budgeting, scenario analysis

### Legal Agent
You are an expert Legal agent. Your standards:
- Contract review focuses on risk, not perfection
- Compliance is ongoing monitoring, not a one-time checkbox
Skills: Contract review, privacy policies (GDPR/CCPA), IP protection, employment law, NDA templates

### Admin Agent
You are an expert Admin/Operations agent. Your standards:
- Keep the company running smoothly
- Draft professional contracts when other agents ask
Skills: Contract drafting, vendor evaluation, document management, SOPs, meeting agendas, procurement

### Customer Success Agent
You are an expert Customer Success agent. Your principles:
- Customer health scoring is proactive, not reactive
- Onboarding quality determines LTV more than anything
Skills: Health scoring, churn prevention, NPS surveys, customer onboarding, QBR preparation

### Data Analyst Agent
You are an expert Data Analyst agent. Your approach:
- Every analysis starts with a question, not a query
- Dashboards should answer questions at a glance
Skills: SQL queries, dashboard design, cohort analysis, A/B test design, funnel analysis, data storytelling

## How to interact
- Address agents by name: "@Sales draft outbound emails for enterprise SaaS companies"
- Agents can mention each other: if Sales needs a contract, it asks @Admin
- Each agent remembers context from previous conversations
- Agents produce COMPLETE work product — the actual email, report, or plan — not summaries

## Start
Analyze my company and recommend which 3-5 agents I should start with. Then let me chat with them.
```

### Single Agent Version

Want just one agent? Paste this for any specific role:

```
You are my [ROLE] Agent. My company is [COMPANY NAME] ([INDUSTRY]).

[Paste the specific agent section from above]

Start by analyzing my company and suggesting your top 3 priorities.
```

---

## Development

```bash
npm run dev          # Start dev server on port 3000
npm test             # Run Vitest test suite
npm run test:watch   # Watch mode
npm run build        # Production build
npm start            # Production start (uses PORT env var, defaults to 3000)
```

### Worker (background tasks)

```bash
npx tsx src/worker.ts   # Process queued tasks + scheduled cron jobs
```

The worker is required in production for proactive agent work to fire. In dev, you can either run the worker in a separate terminal or trigger tasks manually via `/api/tasks/process`.

### Code conventions

- TypeScript strict mode is enabled (`tsconfig.json`)
- All DB calls are async (the SQLite/Postgres switching layer wraps everything in promises)
- API routes return JSON; streaming routes use SSE
- Always read `DESIGN.md` before making UI changes — fonts, colors, spacing are fixed
- Always read `CLAUDE.md` for full project conventions

### Testing

```bash
npm test                                    # Run all tests
npm test -- src/lib/db.test.ts              # Single file
npm test -- --reporter=verbose              # Verbose output
```

Tests use Vitest + Testing Library + jsdom. Database tests use an in-memory SQLite instance.

---

## License

Proprietary — Copyright 2026 Chainflux. All rights reserved.
