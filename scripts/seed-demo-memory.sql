-- Demo seed for the in-app Memory ("/admin/memory") — populates the agent
-- key/value memory + lessons sources so the shared brain shows real content
-- WITHOUT needing an embedding key or the knowledge-graph migration.
--
-- Target: Abhinav's Workspace (co_jaa_9cfcecf968f1).
-- Run:    psql "$DATABASE_URL" -f scripts/seed-demo-memory.sql
--   (or paste into the Supabase SQL editor). No redeploy needed — the Memory
--   page reads live; just refresh /admin/memory after running.
-- Idempotent: re-running is a no-op (ON CONFLICT DO NOTHING).

\set company 'co_jaa_9cfcecf968f1'

-- ── Agents (the Memory + Lessons sources iterate the company's agents) ──────
INSERT INTO agents (id, company_id, role, system_prompt, status, created_at) VALUES
  ('ag_demo_ceo',        :'company', 'CEO',        'You are the CEO orchestrator agent.', 'online', now()),
  ('ag_demo_sales',      :'company', 'Sales',      'You are the Sales agent.',            'online', now()),
  ('ag_demo_marketing',  :'company', 'Marketing',  'You are the Marketing agent.',        'online', now()),
  ('ag_demo_accounting', :'company', 'Accounting', 'You are the Accounting agent.',       'online', now())
ON CONFLICT (id) DO NOTHING;

-- ── Per-agent key/value memory (source #1) ─────────────────────────────────
INSERT INTO memory (id, agent_id, key, value, created_at, updated_at) VALUES
  ('mem_demo_1', 'ag_demo_sales',      'icp',          'B2B FinTech, 50–500 employees, US & UK. Buyer: VP Sales / CRO.', now(), now()),
  ('mem_demo_2', 'ag_demo_sales',      'best_channel', 'LinkedIn + email outperform cold calls ~3:1 for this ICP.',      now(), now()),
  ('mem_demo_3', 'ag_demo_marketing',  'brand_voice',  'Confident, cerebral, premium — boardroom, not hackathon.',       now(), now()),
  ('mem_demo_4', 'ag_demo_accounting', 'filing_cadence','GST monthly by the 11th; TDS quarterly.',                       now(), now()),
  ('mem_demo_5', 'ag_demo_ceo',        'north_star',   'Activate 70% of signups within 5 minutes of onboarding.',        now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── Lessons learned across runs (source #2 — the closed loop) ──────────────
INSERT INTO lessons (id, company_id, agent_id, run_id, task_description, output_accepted, modification_detail, self_critique, created_at) VALUES
  ('les_demo_1', :'company', 'ag_demo_sales',      'run_demo_1', 'Draft outbound sequence for FinTech CTOs', 'accepted',
     'Changed subject line from "Demo" to "15-min walkthrough"',
     'FinTech CTOs reply ~2x more to "walkthrough" than "demo" — apply to future sequences.', now()),
  ('les_demo_2', :'company', 'ag_demo_marketing',  'run_demo_2', 'Write SEO brief for "AI agents vs chatbots"', 'accepted',
     'Led with a comparison table above the fold',
     'Tables above the fold lifted dwell time — reuse for comparison posts.', now()),
  ('les_demo_3', :'company', 'ag_demo_accounting', 'run_demo_3', 'Categorise Q2 vendor invoices', 'accepted',
     'Flagged 3 duplicate invoices before posting',
     'Always dedupe by (vendor, amount, date) before posting — caught a double-payment.', now()),
  ('les_demo_4', :'company', 'ag_demo_sales',      'run_demo_4', 'Qualify inbound lead from Acme Corp', 'revised',
     'Re-scored from SQL to MQL after a budget check',
     'Don''t mark SQL without confirmed budget — it cost a wasted demo slot.', now())
ON CONFLICT (id) DO NOTHING;
