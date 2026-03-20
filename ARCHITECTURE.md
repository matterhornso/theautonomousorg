# Architecture — TheAutonomous.org

## Core Concept

Each company gets a fleet of AI agents. Each agent is an isolated Claude Code instance running in the cloud with:
- A role-specific system prompt and skills
- Company context auto-researched from the web
- Persistent memory across conversations
- Role-specific MCP connectors (Apollo for Sales, Instantly for Marketing, etc.)
- Messaging bridge (WhatsApp or Telegram)
- Multi-user access (whole teams can talk to one agent)
- Inter-agent communication

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TheAutonomous Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │  Web App      │    │  Company Research Engine              │   │
│  │  (Next.js)    │───▶│  - Website scraping                  │   │
│  │              │    │  - Social media analysis              │   │
│  │  - Onboarding │    │  - News/press coverage               │   │
│  │  - Dashboard  │    │  - Competitor landscape               │   │
│  │  - Agent mgmt │    │  - Generates company-context.md       │   │
│  └──────┬───────┘    └──────────────┬───────────────────────┘   │
│         │                           │                            │
│         ▼                           ▼                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Agent Orchestrator                       │   │
│  │  - Provisions new agent instances                         │   │
│  │  - Manages agent lifecycle (start/stop/scale)             │   │
│  │  - Routes messages between users ↔ agents                 │   │
│  │  - Routes messages between agents ↔ agents                │   │
│  └──────┬──────────────────┬──────────────────┬─────────────┘   │
│         │                  │                  │                   │
│         ▼                  ▼                  ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Sales Agent  │  │ Marketing   │  │ Strategy    │  ... more   │
│  │ (Instance)   │  │ Agent       │  │ Agent       │             │
│  │             │  │ (Instance)   │  │ (Instance)   │             │
│  │ Skills:     │  │             │  │             │             │
│  │ - Outbound  │  │ Skills:     │  │ Skills:     │             │
│  │ - CRM mgmt  │  │ - Content   │  │ - Research  │             │
│  │ - Pipeline  │  │ - SEO       │  │ - Modeling  │             │
│  │             │  │ - Campaigns │  │ - Analysis  │             │
│  │ MCPs:       │  │             │  │             │             │
│  │ - Apollo    │  │ MCPs:       │  │ MCPs:       │             │
│  │ - HubSpot   │  │ - Instantly │  │ - Web search│             │
│  │ - Calendly  │  │ - Buffer    │  │ - Crunchbase│             │
│  │             │  │ - SEMrush   │  │             │             │
│  │ Context:    │  │             │  │ Context:    │             │
│  │ COMPANY.md  │  │ Context:    │  │ COMPANY.md  │             │
│  │ SALES.md    │  │ COMPANY.md  │  │ STRATEGY.md │             │
│  │             │  │ MARKETING.md│  │             │             │
│  │ Memory:     │  │             │  │ Memory:     │             │
│  │ Persistent  │  │ Memory:     │  │ Persistent  │             │
│  │ per-user    │  │ Persistent  │  │ per-user    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Messaging Bridge                          │   │
│  │  ┌────────────┐  ┌────────────┐                           │   │
│  │  │  WhatsApp   │  │  Telegram   │                           │   │
│  │  │  (Twilio)   │  │  (Bot API)  │                           │   │
│  │  └────────────┘  └────────────┘                           │   │
│  │                                                            │   │
│  │  Features:                                                 │   │
│  │  - Multi-user per agent (team access)                     │   │
│  │  - User identification from phone number                  │   │
│  │  - Message routing: @sales, @marketing, or auto-detect    │   │
│  │  - Inter-agent forwarding                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Data Layer                            │   │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────┐               │   │
│  │  │Postgres  │  │ Redis    │  │ S3/R2     │               │   │
│  │  │- Users   │  │- Sessions│  │- Skills   │               │   │
│  │  │- Companies│  │- Queues  │  │- Context  │               │   │
│  │  │- Agents  │  │- Pub/Sub │  │  files    │               │   │
│  │  │- Messages│  │          │  │- Memory   │               │   │
│  │  │- Memory  │  │          │  │  exports  │               │   │
│  │  └─────────┘  └──────────┘  └───────────┘               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Instance Model

Each agent is an isolated process (container or cloud instance) running Claude with:

### 1. System Prompt (CLAUDE.md)
```
You are the {Role} Agent for {Company Name}.
{Role-specific instructions and personality}
{Company context from COMPANY.md}
You have access to the following tools: {MCP list}
You can communicate with other agents: {agent roster}
```

### 2. Company Context (COMPANY.md) — auto-generated
Produced by the Research Engine when a company onboards:
- Company overview, mission, products/services
- Target market and customer segments
- Key competitors and market position
- Team structure (if discoverable)
- Recent news, funding, launches
- Social media presence and tone

### 3. Role Context ({ROLE}.md) — role-specific
Pre-built knowledge base per role:
- Sales: sales methodology, pipeline stages, outreach templates
- Marketing: brand guidelines, content calendar framework, channel strategy
- Accounting: chart of accounts, compliance requirements, reporting cadence
- etc.

### 4. Skills (downloadable)
Each role has a set of skill files (like gstack skills) that define capabilities:
- Sales: /prospect, /sequence, /pipeline, /forecast
- Marketing: /content, /seo-audit, /campaign, /social
- Engineering: /review, /deploy, /debug, /architect

Users can download these skills to use locally with their own Claude Code.

### 5. MCP Connectors
Pre-configured tool integrations per role:

| Role | MCPs / Connectors |
|------|-------------------|
| Sales | Apollo.io, HubSpot/Salesforce, Calendly, Gmail/Outlook |
| Marketing | Instantly.ai, Buffer/Hootsuite, SEMrush/Ahrefs, Canva |
| Accounting | QuickBooks, Xero, Stripe, Plaid |
| Strategy | Crunchbase, SimilarWeb, Google Trends, Web Search |
| Product | Linear/Jira, Notion, Figma (read), UserTesting |
| Front-End Eng | GitHub, Vercel, Chromatic, Lighthouse |
| Back-End Eng | GitHub, AWS/GCP, Datadog, PagerDuty |
| AI Expert | Anthropic API, OpenAI API, HuggingFace, Weights & Biases |
| Admin/Legal | DocuSign, Google Workspace, Slack |

### 6. Persistent Memory
- Per-user memory: each team member's preferences, past requests, context
- Per-agent memory: learned company knowledge, decisions made, task history
- Cross-conversation: memory persists across sessions (stored in DB + memory files)

### 7. Inter-Agent Communication
Agents can message each other through the orchestrator:
```
Sales Agent → Orchestrator → Admin Agent
"Draft a sales contract for Acme Corp, $50k/year, 2-year term"
```
The orchestrator routes the message, and the receiving agent can respond
asynchronously. The requesting agent (and connected users) get notified.

## User Flow

```
1. User enters website URL
   ↓
2. Research Engine analyzes company
   - Scrapes website
   - Checks social media (LinkedIn, Twitter)
   - Searches news/press
   - Generates COMPANY.md
   ↓
3. Platform recommends agents
   - Shows recommendations with reasons
   - User selects which to activate
   ↓
4. User chooses messaging channel
   - WhatsApp or Telegram
   - Links their phone number
   ↓
5. Agent instances provisioned
   - Each selected agent gets its own instance
   - Loaded with: system prompt + company context + role context + skills + MCPs
   ↓
6. Agents go live
   - User can message agents via WhatsApp/Telegram
   - Multiple team members can connect
   - Agents start working and building memory
   ↓
7. Ongoing
   - Agents learn from conversations (persistent memory)
   - Agents collaborate with each other
   - Users can download skills for local use
   - Dashboard shows agent activity, tasks, and metrics
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js (current) |
| API | Next.js API routes → migrate to separate service as needed |
| Agent Runtime | Claude API with tool use (or Claude Code SDK for full instance) |
| Database | Postgres (Supabase) |
| Cache/Queues | Redis (Upstash) |
| File Storage | S3 or Cloudflare R2 (skills, context files, memory) |
| WhatsApp | Twilio WhatsApp Business API |
| Telegram | Telegram Bot API |
| Agent Hosting | Fly.io or Railway (container per agent) |
| Auth | Clerk |
| Payments | Stripe |
