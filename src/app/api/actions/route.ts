import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompaniesByUser, getCompanyActions, getAgentActions, getAgent } from "@/lib/db";
import { inTenant } from "@/lib/with-tenant-route";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  const agentId = request.nextUrl.searchParams.get("agentId");
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1), 100);

  if (agentId) {
    // Verify the requesting user owns the agent's company
    const agent = await getAgent(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const companies = await getCompaniesByUser(userId);
    if (!companies.find((c) => c.id === agent.company_id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const actions = await inTenant(agent.company_id, userId, () =>
      getAgentActions(agentId, limit)
    );
    return NextResponse.json(actions);
  }

  if (companyId) {
    const companies = await getCompaniesByUser(userId);
    if (!companies.find((c) => c.id === companyId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const actions = await inTenant(companyId, userId, () =>
      getCompanyActions(companyId, limit)
    );
    return NextResponse.json(actions);
  }

  return NextResponse.json({ error: "companyId or agentId required" }, { status: 400 });
}
