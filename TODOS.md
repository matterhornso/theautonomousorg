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

## Onboarding Provisioning Animation
- **What:** Animated screen showing agents "coming online" during provisioning
- **Why:** The 2-5 second provisioning wait is a delight opportunity. Show each agent card flipping from "Queued" → "Configuring" → "Online".
- **How:** Create /provisioning/[id] route. WebSocket or polling for agent status. Staggered card animations. Auto-redirect to dashboard when all ready.
- **Effort:** ~1h CC time
- **Priority:** P3
- **Depends on:** Nothing

## Agent Skill Marketplace
- **What:** Third-party developers can build and sell agent skills on the platform
- **Why:** Unlocks network effects — more skills = more value = more users = more developers
- **How:** Define skill package format (like gstack skills). Skill registry API. Revenue share model. Developer portal.
- **Effort:** Ocean — multi-quarter project
- **Priority:** P4 (future)
- **Depends on:** Stable agent architecture, meaningful user base

## Custom Agent Builder
- **What:** Users define their own agent roles with custom instructions, skills, and connectors
- **Why:** 14 pre-built roles won't cover every business need. Power users want custom agents.
- **How:** Agent builder UI (name, instructions, skill selection, connector config). Save as custom role in DB.
- **Effort:** ~4h CC time
- **Priority:** P3
- **Depends on:** MCP integrations (need real connectors to configure)

## Enterprise SSO (SAML/OIDC)
- **What:** Enterprise customers authenticate via their identity provider
- **Why:** Required for enterprise sales. Companies won't adopt without SSO.
- **How:** Clerk supports SAML/OIDC on enterprise plan. Enable in Clerk dashboard. Map Clerk organizations to companies.
- **Effort:** ~2h CC time
- **Priority:** P3
- **Depends on:** Clerk enterprise plan

## Self-Serve API
- **What:** REST API for programmatic agent access (create agents, send messages, get task results)
- **Why:** Developers want to integrate agents into their own workflows and tools
- **How:** API key management. Rate limiting. OpenAPI spec. SDK generation.
- **Effort:** ~4h CC time
- **Priority:** P3
- **Depends on:** Stable agent architecture, billing (API usage metering)

## Agent Performance Analytics
- **What:** Dashboard showing agent effectiveness metrics (tasks completed, response quality, user satisfaction)
- **Why:** Users need to know if agents are delivering value. Required for enterprise justification.
- **How:** Track task completion rate, average response time, user ratings. Dashboard with charts.
- **Effort:** ~3h CC time
- **Priority:** P3
- **Depends on:** Meaningful usage data (need users running agents for weeks)

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
