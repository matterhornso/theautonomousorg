import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { getAgentsByCompany, getAgent } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = authenticateApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const agentId = request.nextUrl.searchParams.get("id");

  if (agentId) {
    const agent = getAgent(agentId);
    if (!agent || agent.company_id !== auth.companyId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: agent.id,
      role: agent.role,
      status: agent.status,
      skills: JSON.parse(agent.skills_json || "[]"),
      connectors: JSON.parse(agent.connectors_json || "[]"),
      created_at: agent.created_at,
    });
  }

  const agents = getAgentsByCompany(auth.companyId);
  return NextResponse.json(
    agents.map((a) => ({
      id: a.id,
      role: a.role,
      status: a.status,
      skills: JSON.parse(a.skills_json || "[]"),
      connectors: JSON.parse(a.connectors_json || "[]"),
      created_at: a.created_at,
    }))
  );
}
