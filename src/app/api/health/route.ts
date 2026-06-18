import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check environment variables
  checks.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ? "set" : "MISSING";
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "MISSING";
  checks.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ? "set" : "MISSING";
  checks.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? "set" : "MISSING";

  // Check database connection
  if (process.env.DATABASE_URL) {
    try {
      const { default: postgres } = await import("postgres");
      const isPooler = process.env.DATABASE_URL.includes(":6543") || process.env.DATABASE_URL.includes("pooler.supabase.com");
      const sql = postgres(process.env.DATABASE_URL, {
        max: 1,
        connect_timeout: 5,
        ssl: "require",
        prepare: isPooler ? false : true,
      });
      const result = await sql`SELECT 1 as ok`;
      checks.database = result[0]?.ok === 1 ? "connected" : "unexpected";
      await sql.end();
    } catch (error) {
      // Log the detail server-side; don't leak DB internals to a public endpoint.
      console.error("[health] database check failed:", error);
      checks.database = "FAILED";
    }
  } else {
    checks.database = "SKIPPED (no DATABASE_URL)";
  }

  const allGood = Object.values(checks).every(
    (v) => v === "set" || v === "connected"
  );

  return NextResponse.json(
    { status: allGood ? "healthy" : "degraded", checks },
    { status: allGood ? 200 : 503 }
  );
}
