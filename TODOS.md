# TODOs — TheAutonomous.org

## Completed

### ~~MCP Integrations~~ — DONE (aac0547, 2026-03-21)
Apollo.io (prospect search, enrichment, company search), Instantly.ai (campaigns, leads, analytics), Web Search (URL fetch, content extraction). All registered as Claude tools for relevant agents.

### ~~Telegram Messaging Bridge~~ — DONE (aac0547, 2026-03-21)
POST /api/messaging/telegram webhook, bot commands (/start, /agents), @Role agent routing, user identification, webhook secret validation. Needs TELEGRAM_BOT_TOKEN to activate.

### ~~Onboarding Provisioning Animation~~ — DONE (0bf72dc, 2026-03-21)
/provisioning/[companyId] with staggered agent cards animating Queued → Configuring → Online, auto-redirect to dashboard.

### ~~Custom Agent Builder~~ — DONE (0bf72dc, 2026-03-21)
/dashboard/[companyId]/builder with full UI, POST /api/agents/custom, skill picker, connector picker, auto-enqueues initial task.

### ~~Self-Serve API~~ — DONE (0bf72dc, 2026-03-21)
/api/v1/agents, /api/v1/chat, /api/v1/tasks with Bearer token auth (ta_live_* keys). API key management via /api/keys.

### ~~Agent Performance Analytics~~ — DONE (0bf72dc, 2026-03-21)
/dashboard/[companyId]/analytics with overview cards, task pipeline chart, per-agent performance table.

### ~~Rate Limiting~~ — DONE (aac0547, 2026-03-21)
In-memory sliding window rate limiter. analyze (10/min), chat (30/min), provision (5/min), api_v1 (60/min). Applied to /api/analyze.

### ~~Input Validation~~ — DONE (aac0547, 2026-03-21)
URL validation (format, protocol, blocks private IPs), XSS sanitization, string/array/email validation. Applied to /api/analyze.

### ~~BYOK Connector Settings~~ — DONE (aac0547, 2026-03-21)
/dashboard/[companyId]/settings with API key management UI + connector grid (platform-provided vs BYOK).

---

## Remaining

## WhatsApp Messaging Bridge
- **What:** Twilio WhatsApp Business API integration
- **Why:** Landing page promises WhatsApp access. Mobile-first users expect it.
- **Effort:** ~3h CC time + 1-3 weeks WhatsApp verification
- **Priority:** P2
- **Blocker:** External — Meta verification timeline (start application ASAP)

## Postgres Migration (Supabase)
- **What:** Migrate from SQLite to Postgres for production deployment
- **Why:** SQLite is single-writer, can't scale, won't work on Vercel serverless
- **Effort:** ~2h CC time
- **Priority:** P1
- **Depends on:** Supabase project creation

## ~~Dedicated Task Worker~~ — DONE (2026-03-22)
Deployed on Railway. Polls Supabase tasks table every 10s. No timeout limits.

## Enterprise SSO (SAML/OIDC)
- **What:** Enterprise customers authenticate via their identity provider
- **Effort:** ~2h CC time
- **Priority:** P3
- **Depends on:** Clerk enterprise plan

## ~~Agent Skill Marketplace~~ — REMOVED
Not pursuing. TA provides agents to do tasks, not a marketplace for skills.

## Mobile App
- **What:** React Native app for managing agents on mobile
- **Effort:** ~2 weeks CC time
- **Priority:** P4 (future)

## SOC2 Compliance
- **What:** SOC2 Type II audit and certification
- **Effort:** Months of process
- **Priority:** P4 (post-revenue)
