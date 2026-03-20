# TheAutonomous.org

## Project
AI-powered platform that enables companies to run their entire business with AI agents for every workflow: Sales, Marketing, Accounting, Strategy, Product Development, Engineering (front-end & back-end), Product Management, and AI expertise. Users enter their company website, get recommended agents, and communicate with them via WhatsApp. Agents default to Claude Opus but users can bring their own models.

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
