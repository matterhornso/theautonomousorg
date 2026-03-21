#!/usr/bin/env npx tsx
/**
 * Postgres Schema Migration Script
 *
 * Sets up all tables in Supabase/Postgres.
 * Run once when switching from SQLite to Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/migrate-postgres.ts
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: Set DATABASE_URL environment variable");
  console.error("Example: DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres npx tsx scripts/migrate-postgres.ts");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log("Connecting to Postgres...");
  console.log(`  Host: ${DATABASE_URL!.replace(/:[^@]+@/, ':***@')}`);
  console.log("");

  const tables = [
    {
      name: "user_profiles",
      sql: sql`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          full_name TEXT,
          role_title TEXT,
          company_name TEXT,
          company_website TEXT,
          company_size TEXT,
          industry TEXT,
          current_tools TEXT,
          biggest_challenges TEXT,
          automation_goals TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
      name: "companies",
      sql: sql`
        CREATE TABLE IF NOT EXISTS companies (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          industry TEXT,
          description TEXT,
          stage TEXT,
          analysis_json TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
      name: "agents",
      sql: sql`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL REFERENCES companies(id),
          role TEXT NOT NULL,
          system_prompt TEXT NOT NULL,
          company_context TEXT,
          skills_json TEXT,
          connectors_json TEXT,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
      name: "conversations",
      sql: sql`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES agents(id),
          title TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
      name: "messages",
      sql: sql`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id),
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
      name: "memory",
      sql: sql`
        CREATE TABLE IF NOT EXISTS memory (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES agents(id),
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(agent_id, key)
        )`,
    },
    {
      name: "tasks",
      sql: sql`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES agents(id),
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          input_json TEXT,
          result_json TEXT,
          retry_count INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        )`,
    },
    {
      name: "subscriptions",
      sql: sql`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL REFERENCES companies(id) UNIQUE,
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          plan TEXT NOT NULL DEFAULT 'free',
          status TEXT NOT NULL DEFAULT 'active',
          current_period_end TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
      name: "usage_records",
      sql: sql`
        CREATE TABLE IF NOT EXISTS usage_records (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL REFERENCES companies(id),
          month TEXT NOT NULL,
          task_count INTEGER DEFAULT 0,
          message_count INTEGER DEFAULT 0,
          UNIQUE(company_id, month)
        )`,
    },
    {
      name: "api_keys",
      sql: sql`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL REFERENCES companies(id),
          key_hash TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          last_used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
      name: "inter_agent_messages",
      sql: sql`
        CREATE TABLE IF NOT EXISTS inter_agent_messages (
          id TEXT PRIMARY KEY,
          source_agent_id TEXT NOT NULL REFERENCES agents(id),
          target_agent_id TEXT NOT NULL REFERENCES agents(id),
          request TEXT NOT NULL,
          response TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          conversation_id TEXT REFERENCES conversations(id),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        )`,
    },
    {
      name: "messaging_users",
      sql: sql`
        CREATE TABLE IF NOT EXISTS messaging_users (
          id TEXT PRIMARY KEY,
          company_id TEXT REFERENCES companies(id),
          platform TEXT NOT NULL,
          platform_user_id TEXT NOT NULL,
          display_name TEXT,
          default_agent_id TEXT REFERENCES agents(id),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(platform, platform_user_id)
        )`,
    },
  ];

  for (const table of tables) {
    try {
      await table.sql;
      console.log(`  ✓ ${table.name}`);
    } catch (error) {
      console.error(`  ✗ ${table.name}: ${error}`);
    }
  }

  // Create indexes
  console.log("\nCreating indexes...");
  const indexes = [
    { name: "idx_agents_company", sql: sql`CREATE INDEX IF NOT EXISTS idx_agents_company ON agents(company_id)` },
    { name: "idx_tasks_status", sql: sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at)` },
    { name: "idx_tasks_agent", sql: sql`CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id)` },
    { name: "idx_messages_conv", sql: sql`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)` },
    { name: "idx_memory_agent", sql: sql`CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory(agent_id)` },
    { name: "idx_companies_user", sql: sql`CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id)` },
  ];

  for (const index of indexes) {
    try {
      await index.sql;
      console.log(`  ✓ ${index.name}`);
    } catch (error) {
      console.error(`  ✗ ${index.name}: ${error}`);
    }
  }

  console.log("\n✓ Migration complete!");
  console.log("\nNext steps:");
  console.log("  1. Uncomment DATABASE_URL in .env.local");
  console.log("  2. In src/lib/db.ts, add: export * from './db-postgres' (or swap the file)");
  console.log("  3. Restart dev server");

  await sql.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
