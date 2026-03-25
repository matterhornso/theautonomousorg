import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentLeaderboard, getCompany } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const company = await getCompany(companyId);
  if (!company || company.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const leaderboard = await getAgentLeaderboard(companyId);
  return NextResponse.json({ leaderboard });
}
