/**
 * Bootstrap the base schema (companies, agents, messages, messaging_users, etc.)
 * by calling initSchema() once. After this runs, migrations 001-005 can be
 * applied on top.
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' bun run scripts/init-base-schema.ts
 */

import { initSchema, sql } from "../src/lib/db-postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

console.log("Initializing base schema…");
await initSchema();
console.log("Base schema initialized.");

const rows = (await sql`
  SELECT count(*)::int AS n FROM information_schema.tables
  WHERE table_schema='public'
`) as Array<{ n: number }>;
console.log(`public schema now has ${rows[0]!.n} tables.`);

await sql.end();
process.exit(0);
