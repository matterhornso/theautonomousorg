---
title: The Autonomous — Investor One-Pager
subtitle: The operating system for AI-native companies
author: Abhinav Ramesh · Chainflux
date: 2026-05-12
---

# The Autonomous

**The operating system for AI-native companies.**

A workforce of AI agents with shared memory, real tool integrations, and the model of your choice. Enter your website. Get your AI workforce. Two minutes.

---

## The thesis

The dominant companies of the next decade will not *use* AI. They will **run on** AI. Every workflow, every decision, every artifact will flow through an intelligence layer that learns and improves on its own.

Today, most AI products force a false choice:

- **Chatbots** give you a sliver of memory and no execution
- **RPA / automation** gives you execution but no memory
- **Vertical agents** solve one function in isolation

We give companies **both halves of the loop, as one system** — a persistent memory (the brain) and a coordinated workforce (the hands) that share context and compound learning across every business function.

---

## The product

| Surface | What it is | Who pays |
|---|---|---|
| **Autonomous Agents** (`theautonomous.org`) | 15 pre-built role agents — Sales, Marketing, Legal, Finance, HR, Strategy, Product, Eng (FE + BE), AI Expert, Admin, Customer Success, Data Analyst, CEO orchestrator — with real tool integrations and inter-agent collaboration via @mentions. | SMB founders, ops leaders ($49–custom/mo + credits) |
| **Autonomous Memory** (`memory.theautonomous.org`) | Meeting capture → Deepgram transcription → Claude entity extraction → MongoDB knowledge graph. Pre-meeting briefs in seconds. Same memory feeds the agents. | Executives, VP+ ($99–$299/mo, no free tier) |

**Key technical wedge:** the two products share one identity layer (Clerk) and one knowledge graph. Memory is not a silo — it is the brain the workforce runs on. **No competitor ships both halves.**

---

## Why now

1. **Model capability crossed the threshold.** Claude Sonnet 4.6 is the first model whose reasoning is reliable enough to act, not just answer. We default to it. Customers can bring any OpenAI-compatible model.
2. **YC, Block, StrongDM, Mutiny** are all publicly building this way. The "AI-native company" thesis has gone mainstream in the last six months.
3. **The labor / capital substitution is now defensible math.** A large API bill replaces salary, benefits, recruiting, and coordination overhead. We're the first platform pricing this honestly (credits-based, not seats).
4. **SMBs are the wedge.** Incumbents can't unwind their org charts; startups have no legacy to retrain. We win the bottom of the market, then ride the same teams up.

---

## Differentiation

| | Chatbots (ChatGPT, Claude.ai) | Vertical agents (11x, Lindy) | Notetakers (Otter, Fireflies, Granola) | **The Autonomous** |
|---|---|---|---|---|
| Persistent company memory | ✗ | ✗ | Transcripts only | **Structured knowledge graph** |
| Multi-role workforce | ✗ | One function | ✗ | **15 roles + custom** |
| Inter-agent collaboration | ✗ | ✗ | ✗ | **Yes (@mentions)** |
| Real tool integrations | Partial | One vertical | ✗ | **Yes, every role** |
| Model-agnostic (BYOM) | ✗ | ✗ | ✗ | **Yes** |
| Multi-channel access | Web only | Web only | Web only | **Web + WhatsApp + Telegram** |
| Two-minute onboarding | n/a | Hours-days | Minutes | **2 minutes** |

---

## Traction

*(As of 2026-05-12)*

- **Live demos shipped against real customer infrastructure:**
  - Shopify Editor for getsoma.store (`zizrev-ej.myshopify.com`) — plan → apply → rollback verified end-to-end with Claude tool-use loop
  - Telegram timesheet bot for JAA Associates — full webhook + cron + admin UI verified live
- **Engineering health:** 264/264 tests passing, type-check clean, migrations 001–006 applied to production Supabase
- **Auth + identity:** Clerk (shared between agents and memory products)
- **Deployed surface:** theautonomous.org live on Railway
- **Memory product:** code-complete scaffolding (voice/memory/brief/billing APIs), Auth0 → Clerk migration done; pending env provisioning + deploy
- **Existing content footprint:** 3 long-form SEO posts live, full marketing skill bundle in repo

---

## Business model

**Credits-based, not seat-based.**

- 50 credits per agent interaction
- Free tier: 1,000 credits (~20 conversations) — no card
- Growth: $49/mo · 5,000 credits + BYOM + Slack
- Enterprise: unlimited credits, SOC2, HIPAA, custom models

**Memory tier:** $99 (Early Access) → $299 (Executive) → Custom (Enterprise). No free tier — this is the highest-LTV cohort.

**Cross-sell:** Memory customers convert to Agents (the brain becomes more useful when the hands exist). Agents customers convert to Memory (the agents are smarter when the brain is fuller). One identity, two ARPUs.

---

## Market

**Primary persona:** Founders, CTOs, COOs at 1–500 person companies who are stretched thin and can't afford to hire for every role.

**Industries:** Tech/SaaS, e-commerce, financial services, healthcare, real estate, education, professional services, manufacturing.

**TAM math:**
- 33M SMBs in the US alone
- Average SMB spends $30K+/yr on tools that automate one function poorly
- Capture even 1% at $1K ARPU = $330M ARR ceiling on US SMB alone
- Global SMB market: 400M+
- Plus the executive memory cohort (high ARPU, high retention)

---

## What we're raising / what's next

*[Placeholder for the round structure — left blank intentionally for the founder to fill in.]*

### Next 12 months
- Production deploy of Memory + cross-product SSO live
- 10 lighthouse customers in two verticals (e-commerce + professional services)
- Native enterprise model gateway (BYOM at scale)
- SOC2 Type I

### What we need
- Capital to extend GTM (founder-led now)
- Design partners in the executive cohort for Memory
- Strategic intros into incumbent SMB tool buyers (Shopify, QuickBooks, HubSpot ecosystem)

---

## Team

**Abhinav Ramesh** — Founder, Chainflux. Built the full stack of both products solo. Background in [founder bio].

---

## The bet, in one sentence

> Every company in the world is about to be rebuilt as an intelligence layer with humans at the edges. We're the operating system they'll run on.

---

**Contact:** abhinav@chainflux.com · theautonomousorg@gmail.com · @chainflux
