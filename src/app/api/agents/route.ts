import { NextRequest, NextResponse } from "next/server";
import { getAgentsByCompany, getAgent, getMemory, getConversationsByAgent } from "@/lib/db";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const agentId = request.nextUrl.searchParams.get("agentId");

  if (agentId) {
    const agent = await getAgent(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
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
