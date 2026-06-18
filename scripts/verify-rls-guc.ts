/**
 * Verifies that the `sql` proxy routes queries onto the active tenant
 * transaction with the RLS GUCs set. Read-only: only SET LOCAL + SELECT inside
 * a transaction (auto-cleared on commit). Run: DATABASE_URL=... bun run scripts/verify-rls-guc.ts
 */
import { sql, basePool } from "../src/lib/db-postgres";
import { withTenantContext, getCurrentTenantContext } from "../src/lib/tenant-context";

async function main() {
  // 1) Outside any context: the proxy uses the base pool, no GUC set.
  const [outside] = await sql<{ c: string | null }[]>`
    SELECT current_setting('app.current_company_id', true) AS c`;
  console.log("outside tenant ctx → app.current_company_id =", JSON.stringify(outside.c));

  // 2) Inside withTenantContext: a plain `sql\`...\`` (NOT the tx param) must see
  //    the GUC, proving the proxy routed onto the tenant transaction.
  const result = await withTenantContext(
    { companyId: "verify-co-123", userId: "verify-user-456" },
    async () => {
      const [row] = await sql<{ c: string; u: string }[]>`
        SELECT current_setting('app.current_company_id', true) AS c,
               current_setting('app.current_user_id', true) AS u`;
      return { row, ctx: getCurrentTenantContext() };
    }
  );

  console.log("inside tenant ctx → GUCs =", JSON.stringify(result.row));
  console.log("ALS ctx visible       =", JSON.stringify(result.ctx));

  const pass =
    outside.c === "" || outside.c === null
      ? result.row.c === "verify-co-123" && result.row.u === "verify-user-456"
      : false;

  await basePool.end({ timeout: 5 });
  if (!pass) {
    console.error("\n❌ FAIL: proxy did not route onto the tenant transaction.");
    process.exit(1);
  }
  console.log("\n✅ PASS: `sql` proxy routes onto the tenant tx; RLS GUCs propagate.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
