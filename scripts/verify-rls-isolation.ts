/**
 * End-to-end RLS isolation proof. Points the app's real db layer (the `sql`
 * proxy + withTenantContext) at a Postgres connected as a NOBYPASSRLS role and
 * asserts that Row-Level Security actually isolates tenants.
 *
 * Run against a throwaway DB seeded with the harness schema:
 *   TEST_DATABASE_URL='postgresql://app_user:app_pw@localhost:5599/postgres?sslmode=disable' \
 *     bun run scripts/verify-rls-isolation.ts
 */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";
if (!process.env.DATABASE_URL) {
  console.error("Set TEST_DATABASE_URL to a Postgres connected as the app_user (NOBYPASSRLS) role.");
  process.exit(2);
}

const { sql, basePool } = await import("../src/lib/db-postgres");
const { withTenantContext, withUserContext } = await import("../src/lib/tenant-context");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "✅" : "❌"} ${name}` + (cond ? "" : `  → ${JSON.stringify(detail)}`));
  if (!cond) failures++;
}
const ids = (rows: Array<{ id: string }>) => JSON.stringify(rows.map((r) => r.id));

// 1) Inside inTenant(co_A): an UNSCOPED select (no WHERE) returns only A's rows.
const aRows = await withTenantContext({ companyId: "co_A", userId: "user_A" }, async () =>
  sql<{ id: string }[]>`SELECT id FROM agents ORDER BY id`);
check("tenant A: unscoped SELECT returns only A's agents", ids(aRows) === '["ag_A1","ag_A2"]', aRows);

// 2) Inside inTenant(co_A): cannot reach B's row even by primary key.
const leak = await withTenantContext({ companyId: "co_A", userId: "user_A" }, async () =>
  sql<{ id: string }[]>`SELECT id FROM agents WHERE id = 'ag_B1'`);
check("tenant A: cannot fetch B's agent by id", leak.length === 0, leak);

// 3) Tenant B sees only B's rows.
const bRows = await withTenantContext({ companyId: "co_B", userId: "user_B" }, async () =>
  sql<{ id: string }[]>`SELECT id FROM agents ORDER BY id`);
check("tenant B: sees only B's agents", ids(bRows) === '["ag_B1"]', bRows);

// 4) OUTSIDE any tenant context (an un-wrapped query): 0 rows — safe failure mode.
const noCtx = await sql<{ id: string }[]>`SELECT id FROM agents`;
check("un-wrapped query returns 0 rows (safe, not a leak)", noCtx.length === 0, noCtx);

// 5) Confirm we really are a NOBYPASSRLS role.
const [who] = await sql<{ u: string; bypass: boolean }[]>`
  SELECT current_user AS u,
         (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`;
check("connected as a NOBYPASSRLS role", who.u === "app_user" && who.bypass === false, who);

// 6) BOOTSTRAP: withUserContext(user_A) — "my companies" returns only A's, none of B's.
const myCos = await withUserContext("user_A", async () =>
  sql<{ id: string }[]>`SELECT id FROM companies WHERE user_id = 'user_A'`);
check("withUserContext: getCompaniesByUser returns only owned companies", ids(myCos) === '["co_A"]', myCos);

const allCosAsUser = await withUserContext("user_A", async () =>
  sql<{ id: string }[]>`SELECT id FROM companies ORDER BY id`);
check("withUserContext: user A cannot see company B", ids(allCosAsUser) === '["co_A"]', allCosAsUser);

await basePool.end({ timeout: 5 });
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED — RLS isolates tenants under app_user.");
process.exit(failures ? 1 : 0);
