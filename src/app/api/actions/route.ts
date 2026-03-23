import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompaniesByUser, getCompanyActions, getAgentActions } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  const agentId = request.nextUrl.searchParams.get("agentId");
  const limit = Number(request.nextUrl.searchParams.get("limit")) || 50;

  if (agentId) {
    const actions = getAgentActions(agentId, limit);
    return NextResponse.json(actions);
  }

  if (companyId) {
    const companies = getCompaniesByUser(userId);
    if (!companies.find((c) => c.id === companyId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const actions = getCompanyActions(companyId, limit);
    return NextResponse.json(actions);
  }

  return NextResponse.json({ error: "companyId or agentId required" }, { status: 400 });
}
