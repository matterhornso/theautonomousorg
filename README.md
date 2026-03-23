# The Autonomous

**AI agents for every role in your company.** Enter your website, get recommended agents, and start automating your workflows — Sales, Marketing, Accounting, Strategy, Product, Engineering, HR, Legal, Finance, and more.

Built by [Chainflux](https://chainflux.io).

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

- [Node.js 20+](https://nodejs.org/)
- An [Anthropic API key](https://console.anthropic.com/) (powers the AI agents)
- Optional: [Clerk](https://clerk.com) account for auth (keyless dev mode works without one)

### 1. Clone and install

```bash
git clone https://github.com/matterhornso/theautonomousorg.git
cd theautonomousorg
npm install
```

### 2. Set up your environment

```bash
cp .env.example .env.local
# Or create .env.local manually:
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local
```

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter any company URL and the platform handles the rest.

### 4. Run tests (optional)

```bash
npm test    # 66 Vitest tests
```

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
| `DESIGN.md` | Design system (fonts, colors, spacing) |
| `src/app/data.ts` | All 15 agent role definitions (skills, connectors, starters) |
| `src/lib/prompts.ts` | How agent system prompts are built |
| `src/lib/mcp/registry.ts` | Tool registry — what each agent can do |
| `src/lib/task-templates.ts` | Proactive tasks that agents auto-execute |
| `src/lib/db.ts` | Database schema and all CRUD operations |

### Adding a New Agent Role

1. Add the role definition to `src/app/data.ts` (icon, skills, connectors, starters)
2. Add role instructions to `src/lib/prompts.ts` (how the agent should behave)
3. Add a toolkit to `src/lib/mcp/registry.ts` (tools and capabilities)
4. Add task templates to `src/lib/task-templates.ts` (proactive work)
5. Add an icon to `src/app/components/agent-icons.tsx`

### Adding an MCP Integration

1. Create a new file in `src/lib/mcp/` (see `apollo.ts` as a reference)
2. Define Claude tool schemas (name, description, input_schema)
3. Implement the executor function that calls the external API
4. Register the tools in `src/lib/mcp/registry.ts`
5. Wire into `src/app/api/chat/route.ts` tool selection

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

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Powers all AI agent conversations |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | No | Clerk auth (keyless mode works without) |
| `CLERK_SECRET_KEY` | No | Clerk auth server-side |
| `APOLLO_API_KEY` | No | Enables Apollo.io prospect search for Sales/Strategy |
| `INSTANTLY_API_KEY` | No | Enables Instantly.ai email campaigns for Sales/Marketing |
| `TELEGRAM_BOT_TOKEN` | No | Enables Telegram messaging bridge |
| `RESEND_API_KEY` | No | Enables email delivery for team invites (via Resend) |
| `STRIPE_SECRET_KEY` | No | Enables billing (free tier works without) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature verification |
| `DATABASE_URL` | No | Postgres connection string (uses SQLite if not set) |

### Railway Deployment

For persistent data on Railway, add a volume mount at `/app/data` in your service settings. Without a volume, SQLite data is lost on each redeploy. Alternatively, set `DATABASE_URL` to a Postgres connection string (e.g. Supabase) and switch to the Postgres database layer (`src/lib/db-postgres.ts`).

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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes, SSE streaming |
| AI | Anthropic Claude Sonnet 4.6 (@anthropic-ai/sdk) |
| Database | SQLite (better-sqlite3) — Postgres ready |
| Auth | Clerk (keyless mode for dev) |
| Billing | Stripe (optional) |
| Testing | Vitest (66+ tests) |
| Design | Instrument Serif + DM Sans, warm gold accent (#D4A853) |
| Worker | Standalone task processor (Railway) |

## Architecture

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

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/           # Website analysis engine
│   │   ├── chat/              # Streaming chat with tool use
│   │   ├── provision/         # Agent provisioning + task enqueuing
│   │   ├── tasks/             # Task processor + scheduler
│   │   ├── agents/            # Status, relay, custom agents, skills
│   │   ├── billing/           # Stripe checkout, webhooks, portal
│   │   ├── credits/           # Credits balance + transactions
│   │   ├── team/              # Team members + agent assignments
│   │   ├── upload/            # File upload + serve
│   │   ├── webhooks/          # Webhook management + receiver
│   │   ├── debrief/           # Daily debrief generation
│   │   ├── user-keys/         # BYOK API key storage
│   │   ├── keys/              # TA API key management
│   │   ├── messaging/telegram/ # Telegram webhook
│   │   ├── v1/                # Self-serve REST API
│   │   └── profile/           # User profile
│   ├── components/
│   │   ├── dashboard/         # Dashboard client + chat UI
│   │   └── agent-icons.tsx    # SVG icons for each role
│   ├── dashboard/[companyId]/
│   │   ├── page.tsx           # Agent dashboard + chat
│   │   ├── agents/            # Agent status overview
│   │   ├── analytics/         # Performance analytics
│   │   ├── builder/           # Custom agent builder
│   │   ├── schedule/          # Cron job scheduling
│   │   ├── team/              # Team management
│   │   ├── skills/            # Skills showcase
│   │   ├── debrief/           # Daily debrief
│   │   ├── telegram/          # Telegram bot setup
│   │   ├── integrations/      # 50+ tools with encrypted key storage
│   │   └── settings/          # API keys + BYOK connectors
│   ├── onboarding/            # 5-step onboarding wizard
│   └── provisioning/          # Agent spawning animation
├── lib/
│   ├── db.ts                  # SQLite database + all CRUD
│   ├── prompts.ts             # System prompt builder
│   ├── task-processor.ts      # Shared task execution logic
│   ├── task-templates.ts      # Proactive task prompts per role
│   ├── auth-helpers.ts        # Company ownership validation
│   ├── suggested-platforms.ts # 25+ BYOK platform definitions
│   ├── debrief.ts             # Debrief generation
│   └── mcp/
│       ├── registry.ts        # Tool registry (15 roles × tools)
│       ├── apollo.ts          # Apollo.io integration
│       ├── instantly.ts       # Instantly.ai integration
│       ├── web-search.ts      # Web search + URL fetch
│       └── ceo-tools.ts       # CEO cross-agent queries
├── proxy.ts                   # Clerk auth middleware
└── worker.ts                  # Background task worker (Railway)
```

## Development

```bash
npm run dev          # Start dev server on port 3000
npm test             # Run 66+ Vitest tests
npm run build        # Production build
```

## License

Proprietary — Copyright 2026 Chainflux. All rights reserved.
