#!/usr/bin/env tsx
/**
 * Initialize Postgres schema.
 * Run: DATABASE_URL=postgres://... npx tsx scripts/init-postgres.ts
 */

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  console.log("Connecting to Postgres...");
  const { initSchema } = await import("../src/lib/db-postgres");
  await initSchema();
  console.log("All tables and indexes created successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Schema init failed:", err);
  process.exit(1);
});
