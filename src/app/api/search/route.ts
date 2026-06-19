import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchMessages, getCompany } from "@/lib/db";
import { inTenant } from "@/lib/with-tenant-route";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  const query = request.nextUrl.searchParams.get("q");
  const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
  const limitStr = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitStr || "50", 10) || 50, 1), 100);

  if (!companyId || !query) {
    return NextResponse.json({ error: "Missing companyId or query" }, { status: 400 });
  }

  if (query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  // Whole handler runs in the tenant tx so the ownership check + the read are
  // both RLS-enforced after the app_user cutover.
  return inTenant(companyId, userId, async () => {
    const company = await getCompany(companyId);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const results = await searchMessages(companyId, query, { agentId, limit });
    return NextResponse.json({ results, query, total: results.length });
  });
}
