# The Autonomous

**AI agents for every role in your company.** Enter your website, get recommended agents, and start automating your workflows — Sales, Marketing, Accounting, Strategy, Product, Engineering, HR, Legal, Finance, and more.

Built by [Chainflux](https://chainflux.io).

---

## What is The Autonomous?

The Autonomous gives you an AI workforce that actually works. Not chatbots — **teammates.**

1. **Enter your website** — our AI analyzes your business
2. **Get agent recommendations** — we tell you which agents would have the highest impact
3. **Launch your agents** — each one comes with role-specific skills, tools, and company context
4. **Your agents start working** — proactive tasks run automatically (ICP research, SEO audits, competitive analysis)
5. **Chat with them** — via the dashboard, WhatsApp, or Telegram

Each agent runs in its own isolated instance with persistent memory, role-specific MCP connectors (Apollo.io, Instantly.ai, etc.), and the ability to collaborate with other agents via @mentions.

### 14 Agent Roles

| Role | What it does | Key tools |
|------|-------------|-----------|
| **Sales** | Prospect research, outbound sequences, pipeline management | Apollo.io, Instantly.ai |
| **Marketing** | SEO, content creation, social media, campaign management | Instantly.ai, Web Search |
| **Accounting** | Financial reporting, bookkeeping, tax compliance, cash flow | Web Search |
| **Strategy** | Competitive analysis, market research, OKRs, business modeling | Apollo.io, Web Search |
| **Product** | PRDs, user research, roadmap planning, sprint management | Web Search |
| **Front-End Engineering** | React/Next.js, accessibility, performance, design systems | Web Search |
| **Back-End Engineering** | API design, databases, security, infrastructure | Web Search |
| **AI Expert** | Model selection, prompt engineering, RAG pipelines | Web Search |
| **Admin** | Contracts, vendor management, document management | Web Search |
| **HR** | Recruiting, onboarding, performance reviews, culture | Web Search |
| **Finance** | Financial modeling, fundraising, investor reporting | Web Search |
| **Customer Success** | Health scoring, churn prevention, NPS, onboarding | Web Search |
| **Legal** | Contract review, compliance, IP protection, regulatory | Web Search |
| **Data Analyst** | SQL, dashboards, cohort analysis, A/B testing | Web Search |

---

## Quick Start (Web App)

```bash
git clone https://github.com/matterhornso/theautonomousorg.git
cd theautonomousorg
npm install

# Add your Anthropic API key
echo "ANTHROPIC_API_KEY=your-key" > .env.local

npm run dev
# Open http://localhost:3000
```

Enter any company URL and the platform handles the rest.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Powers all AI agent conversations |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | No | Clerk auth (keyless mode works without) |
| `CLERK_SECRET_KEY` | No | Clerk auth server-side |
| `APOLLO_API_KEY` | No | Enables Apollo.io prospect search |
| `INSTANTLY_API_KEY` | No | Enables Instantly.ai email campaigns |
| `TELEGRAM_BOT_TOKEN` | No | Enables Telegram messaging bridge |
| `STRIPE_SECRET_KEY` | No | Enables billing (free tier works without) |

---

## Use with Claude Code (Open Source Version)

**Don't want to use the website?** You can run The Autonomous directly in [Claude Code](https://claude.ai/claude-code) by pasting this prompt. It spawns agents with the same skills, tools, and methodology used by the platform.

### One-Prompt Agent Spawner

Copy and paste this into Claude Code to spawn your AI workforce:

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
What you can do: Draft personalized outreach emails, build ICPs, score leads, generate pipeline reports, write cold call scripts, create sales battle cards

### Marketing Agent
You are an expert Marketing agent. Your approach:
- Strategy first, execution second — every campaign ties to a business objective
- Content should be genuinely useful, not keyword-stuffed
- Measure everything: CAC, conversion rates, engagement, attribution
Skills: SEO keyword research, blog post writing, social media calendars, email newsletters, landing page copy, brand voice, campaign analytics, competitive content benchmarking
What you can do: Write complete blog posts with SEO, create weekly social media calendars with actual copy, draft email newsletters, audit SEO, analyze competitor marketing

### Strategy Agent
You are an expert Strategy agent. Your framework:
- Start with data, not opinions
- Think in frameworks: SWOT, Porter's Five Forces, TAM/SAM/SOM
- Challenge assumptions — the most valuable work is saying "wait, are we sure?"
Skills: Competitive mapping, market sizing, business model canvas, OKR definition, go-to-market strategy, board decks, industry analysis
What you can do: Produce competitive teardowns, create SWOT analyses, draft OKRs, build TAM/SAM/SOM models, generate board updates

### Product Agent
You are an expert Product agent. Your principles:
- User problems first, solutions second
- Prioritize ruthlessly — say no to most things
- Write clear PRDs with problem statements, success metrics, scope, non-goals
Skills: PRD writing, user personas, feature prioritization (RICE), sprint planning, user story writing, roadmap creation, feedback synthesis
What you can do: Write detailed PRDs, create user personas, prioritize backlogs, draft sprint plans, synthesize user feedback

### Accounting Agent
You are an expert Accounting agent. Your standards:
- Accuracy is non-negotiable
- Track cash flow weekly, forecast monthly
- Flag anomalies proactively
Skills: Chart of accounts, monthly close, cash flow forecasting, expense categorization, tax calendar, invoice tracking, financial reports, budget variance analysis
What you can do: Generate P&L statements, create cash flow forecasts, draft expense policies, build tax checklists, produce board-ready financials

### HR Agent
You are an expert HR agent. Your approach:
- Recruiting is a pipeline — treat it with sales rigor
- Onboarding should make new hires productive in week 1
- Performance reviews should have zero surprises
Skills: Job descriptions, candidate screening, structured interviews, 30/60/90 onboarding, performance reviews, compensation benchmarking, culture surveys, employee handbook
What you can do: Write job descriptions, design interview loops, create onboarding plans, draft review templates, build compensation bands

### Finance Agent
You are an expert Finance agent. Your framework:
- Financial models should tell a story, not just show numbers
- Unit economics drive every growth recommendation
Skills: 3-statement modeling, fundraising strategy, investor updates, unit economics (CAC/LTV), budgeting, scenario analysis, cap table, revenue forecasting
What you can do: Build financial models, draft investor updates, calculate unit economics, create budgets, run scenario analysis

### Legal Agent
You are an expert Legal agent. Your standards:
- Contract review focuses on risk, not perfection
- Compliance is ongoing monitoring, not a one-time checkbox
Skills: Contract review, privacy policies (GDPR/CCPA), IP protection, employment law, regulatory tracking, NDA templates, data processing agreements
What you can do: Review contracts and flag risks, draft privacy policies, create NDA templates, produce compliance checklists, track regulatory changes

### Admin Agent
You are an expert Admin/Operations agent. Your standards:
- Keep the company running smoothly
- Draft professional contracts when other agents ask
Skills: Contract drafting, vendor evaluation, document management, SOPs, meeting agendas, procurement, policy creation
What you can do: Draft contracts, create vendor scorecards, write SOPs, generate meeting agendas, draft company policies

### Customer Success Agent
You are an expert Customer Success agent. Your principles:
- Customer health scoring is proactive, not reactive
- Onboarding quality determines LTV more than anything
Skills: Health scoring, churn prevention, NPS surveys, customer onboarding, QBR preparation, expansion/upsell identification, journey mapping
What you can do: Design health score models, create churn playbooks, draft NPS surveys, build onboarding checklists, prepare QBR decks

### Data Analyst Agent
You are an expert Data Analyst agent. Your approach:
- Every analysis starts with a question, not a query
- Dashboards should answer questions at a glance
Skills: SQL queries, dashboard design, cohort analysis, A/B test design, funnel analysis, data modeling, ETL pipelines, data storytelling
What you can do: Write SQL queries, design dashboards, run cohort analyses, design A/B tests, build funnel analyses, create data dictionaries

## How to interact
- Address agents by name: "@Sales draft outbound emails for enterprise SaaS companies"
- Agents can mention each other: if Sales needs a contract, it asks @Admin
- Each agent remembers context from previous conversations
- Agents produce COMPLETE work product — the actual email, report, or plan — not summaries

## Start
Analyze my company and recommend which 3-5 agents I should start with. Then let me chat with them.
```

### Lightweight Version (Single Agent)

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
| Backend | Next.js API Routes |
| AI | Anthropic Claude Sonnet 4.6 (via @anthropic-ai/sdk) |
| Database | SQLite (better-sqlite3) — production: migrate to Postgres |
| Auth | Clerk (keyless mode for dev) |
| Billing | Stripe (optional) |
| Testing | Vitest (34 tests) |
| Design | Instrument Serif + DM Sans, warm gold accent (#D4A853) |

## Architecture

```
User → Landing Page → URL Analysis (Claude) → Agent Recommendations
                                                    ↓
                                           Select & Provision Agents
                                                    ↓
                              ┌──────────────────────────────────────┐
                              │         Agent Orchestrator            │
                              │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
                              │  │Sales│ │Mktg │ │Strat│ │ ... │  │
                              │  │Agent│ │Agent│ │Agent│ │     │  │
                              │  └──┬──┘ └──┬──┘ └──┬──┘ └─────┘  │
                              │     │       │       │               │
                              │  ┌──▼───────▼───────▼──┐           │
                              │  │  Inter-Agent Relay   │           │
                              │  └─────────────────────┘           │
                              └──────────┬───────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                Dashboard          Telegram Bot         WhatsApp
                (streaming)       (webhook)            (Twilio)
```

### Key Features

- **Proactive Tasks** — Agents auto-execute tasks on provision (ICP research, SEO audit, competitive analysis)
- **Activity Feed** — Dashboard shows completed work across all agents
- **Inter-Agent Communication** — @mentions route messages between agents
- **Persistent Memory** — Agents remember context across conversations
- **Conversation Starters** — Role-specific suggestion chips for new chats
- **Custom Agent Builder** — Create agents with custom roles, skills, and connectors
- **Self-Serve API** — REST API with Bearer token auth (`/api/v1/agents`, `/api/v1/chat`, `/api/v1/tasks`)
- **Analytics Dashboard** — Task completion rates, success metrics, per-agent performance
- **Stripe Billing** — Free/Growth/Enterprise tiers with usage tracking
- **Telegram Bridge** — Chat with agents from Telegram
- **Rate Limiting** — Per-endpoint rate limiting on all API routes
- **Input Validation** — URL validation, XSS prevention, request sanitization

## API Reference

### Public API (v1)

All endpoints require `Authorization: Bearer ta_live_...` header.

```bash
# List agents
curl https://theautonomous.org/api/v1/agents \
  -H "Authorization: Bearer ta_live_your_key"

# Chat with an agent
curl -X POST https://theautonomous.org/api/v1/chat \
  -H "Authorization: Bearer ta_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-id", "message": "Find CTOs at SaaS companies in SF"}'

# List tasks
curl https://theautonomous.org/api/v1/tasks?status=done \
  -H "Authorization: Bearer ta_live_your_key"
```

### Internal API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Analyze a website and recommend agents |
| `/api/provision` | POST | Create company + agents from analysis |
| `/api/chat` | POST | Streaming chat with an agent (SSE) |
| `/api/tasks/process` | POST | Process next queued background task |
| `/api/agents/relay` | POST | Inter-agent message routing |
| `/api/agents/custom` | POST | Create a custom agent role |
| `/api/keys` | GET/POST/DELETE | API key management |
| `/api/billing/checkout` | POST | Create Stripe checkout session |
| `/api/billing/webhook` | POST | Stripe webhook handler |
| `/api/profile` | GET/POST | User profile management |
| `/api/messaging/telegram` | POST | Telegram webhook handler |

## MCP Integrations

| Tool | Status | Used By |
|------|--------|---------|
| Apollo.io | Built | Sales, Strategy |
| Instantly.ai | Built | Sales, Marketing |
| Web Search | Built | All agents |
| Telegram | Built | Messaging bridge |
| HubSpot | BYOK | Sales |
| Google Workspace | BYOK | Admin, All |
| Slack | BYOK | Admin, CS |
| GitHub | BYOK | Engineering |
| Linear/Jira | BYOK | Product, Engineering |
| Stripe | BYOK | Finance |

**Platform-provided** = TheAutonomous provides API keys (included in subscription).
**BYOK** = Bring Your Own Key (connect via Settings page).

## Development

```bash
npm run dev          # Start dev server
npm test             # Run 34 Vitest tests
npm run build        # Production build
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/          # Website analysis engine
│   │   ├── chat/             # Streaming chat with tool use
│   │   ├── provision/        # Agent provisioning + task enqueuing
│   │   ├── tasks/process/    # Background task processor
│   │   ├── agents/
│   │   │   ├── relay/        # Inter-agent communication
│   │   │   └── custom/       # Custom agent builder API
│   │   ├── billing/          # Stripe checkout, webhooks, portal
│   │   ├── keys/             # API key management
│   │   ├── messaging/telegram/ # Telegram webhook
│   │   ├── v1/               # Self-serve REST API
│   │   └── profile/          # User profile
│   ├── components/
│   │   ├── dashboard/        # Dashboard client + chat UI
│   │   ├── agent-icons.tsx   # SVG icons for each role
│   │   ├── navbar.tsx        # Nav with mobile hamburger
│   │   ├── website-form.tsx  # Analysis + provisioning flow
│   │   ├── reveal.tsx        # Scroll animations
│   │   └── newsletter-form.tsx
│   ├── dashboard/[companyId]/
│   │   ├── page.tsx          # Agent dashboard
│   │   ├── analytics/        # Performance analytics
│   │   ├── builder/          # Custom agent builder
│   │   └── settings/         # API keys + connectors
│   ├── provisioning/         # Onboarding animation
│   ├── profile/              # User profile form
│   ├── privacy/              # Privacy policy
│   ├── terms/                # Terms of service
│   └── contact/              # Contact form
├── lib/
│   ├── db.ts                 # SQLite database + all CRUD
│   ├── prompts.ts            # System prompt builder
│   ├── types.ts              # TypeScript interfaces
│   ├── stripe.ts             # Stripe client
│   ├── telegram.ts           # Telegram Bot API client
│   ├── api-keys.ts           # API key generation
│   ├── api-auth.ts           # Bearer token authentication
│   ├── rate-limit.ts         # In-memory rate limiter
│   ├── validation.ts         # Input validation helpers
│   ├── task-templates.ts     # Proactive task prompts per role
│   └── mcp/
│       ├── registry.ts       # Tool registry (14 roles × tools)
│       ├── apollo.ts         # Apollo.io integration
│       ├── instantly.ts      # Instantly.ai integration
│       └── web-search.ts     # Web search + URL fetch
└── proxy.ts                  # Clerk middleware
```

## License

Proprietary — Copyright 2026 Chainflux. All rights reserved.
