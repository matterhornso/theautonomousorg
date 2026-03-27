#!/usr/bin/env npx tsx
/**
 * Sync Postgres schema — run this on production after deploy.
 * Adds missing columns and tables that may not exist in Supabase.
 * 
 * Usage: DATABASE_URL=postgresql://... npx tsx scripts/sync-postgres-schema.ts
 */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL required");
  process.exit(1);
}

async function main() {
  const postgres = (await import("postgres")).default;
  const sql = postgres(DATABASE_URL!, { max: 1 });

  console.log("Syncing Postgres schema...\n");

  // Tasks table — add cron columns
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cron_expression TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring INTEGER DEFAULT 0`;
  console.log("✓ tasks: scheduled_at, cron_expression, is_recurring");

  // Debriefs — delivered_via
  await sql`ALTER TABLE debriefs ADD COLUMN IF NOT EXISTS delivered_via TEXT DEFAULT 'dashboard'`;
  console.log("✓ debriefs: delivered_via");

  // User profiles — timezone, notifications
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC'`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS debrief_enabled INTEGER DEFAULT 1`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notifications_enabled INTEGER DEFAULT 1`;
  console.log("✓ user_profiles: timezone, debrief_enabled, notifications_enabled");

  // Agent evals — full schema
  await sql`CREATE TABLE IF NOT EXISTS agent_evals (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    conversation_id TEXT,
    message_id TEXT,
    eval_type TEXT DEFAULT 'auto',
    user_message TEXT,
    agent_response TEXT,
    scores TEXT,
    scores_json TEXT,
    overall_score REAL,
    judge_reasoning TEXT,
    user_feedback TEXT,
    feedback TEXT,
    prompt_used TEXT,
    response_evaluated TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log("✓ agent_evals table");

  // Eval test suites
  await sql`CREATE TABLE IF NOT EXISTS eval_test_suites (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    prompts_json TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log("✓ eval_test_suites table");

  // Eval runs
  await sql`CREATE TABLE IF NOT EXISTS eval_runs (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    results_json TEXT,
    avg_score REAL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log("✓ eval_runs table");

  // Verify
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("\nAll tables:", tables.map(t => t.table_name).join(", "));

  await sql.end();
  console.log("\n✅ Schema sync complete!");
}

main().catch(e => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
