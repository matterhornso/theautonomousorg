import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentsByCompany, getAgent, getMemory, getConversationsByAgent } from "@/lib/db";
import { assertCompanyOwnership } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  const agentId = request.nextUrl.searchParams.get("agentId");

  if (agentId) {
    const agent = await getAgent(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    // Verify the requesting user owns this agent's company
    const ownership = await assertCompanyOwnership(userId, agent.company_id);
    if (!ownership.ok) {
      return ownership.response;
    }
    const memory = await getMemory(agentId);
    const conversations = await getConversationsByAgent(agentId);
    return NextResponse.json({
      ...agent,
      skills: JSON.parse(agent.skills_json || "[]"),
      connectors: JSON.parse(agent.connectors_json || "[]"),
      memory,
      conversations,
    });
  }

  if (companyId) {
    const ownership = await assertCompanyOwnership(userId, companyId);
    if (!ownership.ok) {
      return ownership.response;
    }
    const agents = await getAgentsByCompany(companyId);
    return NextResponse.json(
      agents.map((a) => ({
        ...a,
        skills: JSON.parse(a.skills_json || "[]"),
        connectors: JSON.parse(a.connectors_json || "[]"),
      }))
    );
  }

  return NextResponse.json({ error: "Provide companyId or agentId" }, { status: 400 });
}
