# TODOs — TheAutonomous.org

## MCP Integrations
- **What:** Wire up real MCP connectors for Apollo.io (Sales prospecting), Instantly.ai (email outreach), and Google Workspace (docs/sheets/calendar)
- **Why:** Agents currently only chat — they can't take real actions. Real connectors transform agents from advisors into workers.
- **How:** Research existing MCP servers first (reuse > build). Build OAuth connection flow in dashboard. Register tools with Claude API for function calling. Graceful degradation when connectors not configured.
- **Effort:** ~8h CC time
- **Priority:** P1
- **Depends on:** Stripe billing (need paid tier to gate connector access)

## WhatsApp Messaging Bridge
- **What:** Twilio WhatsApp Business API integration — webhook receives messages, routes to correct agent, sends response back
- **Why:** Landing page promises WhatsApp access. Mobile-first users expect it.
- **How:** Apply for WhatsApp Business verification (1-3 week external process). Build POST /api/messaging/whatsapp webhook. Verify Twilio request signatures. Route by phone number → user → agent.
- **Effort:** ~3h CC time + 1-3 weeks WhatsApp verification
- **Priority:** P2
- **Depends on:** WhatsApp Business API approval (start application ASAP)
- **Blocker:** External — Meta verification timeline

## Telegram Messaging Bridge
- **What:** Telegram Bot API integration — instant setup, no approval needed
- **Why:** Delivers messaging channel without WhatsApp's approval delay. Good fallback.
- **How:** Create Telegram bot via BotFather. Build POST /api/messaging/telegram webhook. Validate X-Telegram-Bot-Api-Secret-Token header. Route messages by Telegram user ID → linked account → agent.
- **Effort:** ~2h CC time
- **Priority:** P2
- **Depends on:** Nothing — can start immediately

## Postgres Migration (Supabase)
- **What:** Migrate from SQLite to Postgres for production deployment
- **Why:** SQLite is single-writer, can't scale, and won't work on serverless (Vercel). Supabase gives managed Postgres + realtime + auth integration.
- **How:** Replace better-sqlite3 with @supabase/supabase-js. Migrate schema (tables already designed). Clean-slate deploy — no data migration needed (dev data only).
- **Effort:** ~2h CC time
- **Priority:** P1
- **Depends on:** Supabase project creation

## Dedicated Task Worker
- **What:** Move background task processing from API route polling to a dedicated Railway/Fly worker
- **Why:** Vercel serverless has 60s function limit. Research tasks may need longer. Dedicated worker has no time constraints.
- **How:** Extract task processor into standalone Node script. Deploy on Railway ($5/mo). Poll tasks table, process one at a time, no timeout limit.
- **Effort:** ~1h CC time
- **Priority:** P2
- **Depends on:** Postgres migration (worker needs persistent DB access)

## ~~Onboarding Provisioning Animation~~ — DONE (0bf72dc, 2026-03-21)
Built: /provisioning/[companyId] with staggered agent cards, auto-redirect to dashboard.

## Agent Skill Marketplace
- **What:** Third-party developers can build and sell agent skills on the platform
- **Why:** Unlocks network effects — more skills = more value = more users = more developers
- **How:** Define skill package format (like gstack skills). Skill registry API. Revenue share model. Developer portal.
- **Effort:** Ocean — multi-quarter project
- **Priority:** P4 (future)
- **Depends on:** Stable agent architecture, meaningful user base

## ~~Custom Agent Builder~~ — DONE (0bf72dc, 2026-03-21)
Built: /dashboard/[companyId]/builder with full UI, POST /api/agents/custom, auto-enqueues initial task.

## Enterprise SSO (SAML/OIDC)
- **What:** Enterprise customers authenticate via their identity provider
- **Why:** Required for enterprise sales. Companies won't adopt without SSO.
- **How:** Clerk supports SAML/OIDC on enterprise plan. Enable in Clerk dashboard. Map Clerk organizations to companies.
- **Effort:** ~2h CC time
- **Priority:** P3
- **Depends on:** Clerk enterprise plan

## ~~Self-Serve API~~ — DONE (0bf72dc, 2026-03-21)
Built: /api/v1/agents, /api/v1/chat, /api/v1/tasks with Bearer token auth. API key management via /api/keys.

## ~~Agent Performance Analytics~~ — DONE (0bf72dc, 2026-03-21)
Built: /dashboard/[companyId]/analytics with overview cards, task pipeline chart, per-agent performance table.

## Mobile App
- **What:** React Native app for managing agents on mobile
- **Why:** WhatsApp/Telegram is good for quick interactions, but a native app gives full dashboard access on mobile
- **Effort:** Ocean — ~2 weeks CC time
- **Priority:** P4 (future)

## SOC2 Compliance
- **What:** SOC2 Type II audit and certification
- **Why:** Required for enterprise customers in regulated industries
- **How:** Engage compliance firm. Implement required controls (logging, access management, encryption). 3-6 month process.
- **Effort:** Ocean — months of process
- **Priority:** P4 (post-revenue)
