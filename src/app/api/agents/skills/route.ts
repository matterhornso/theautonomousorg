import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getAgent,
  getAgentsByCompany,
  getCompaniesByUser,
  getCustomSkills,
  addCustomSkill,
  removeCustomSkill,
} from "@/lib/db";
import { getToolkit } from "@/lib/mcp/registry";

// GET: List all skills for an agent (built-in + custom)
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const toolkit = getToolkit(agent.role);
  const builtInSkills = toolkit?.skills || JSON.parse(agent.skills_json || "[]");
  const capabilities = toolkit?.systemCapabilities || [];
  const customSkills = getCustomSkills(agentId);

  return NextResponse.json({
    role: agent.role,
    builtInSkills,
    capabilities,
    customSkills,
    totalSkills: builtInSkills.length + customSkills.length,
  });
}

// POST: Add a custom skill
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, skill } = (await request.json()) as {
    agentId: string;
    skill: string;
  };

  if (!agentId || !skill?.trim()) {
    return NextResponse.json(
      { error: "agentId and skill are required" },
      { status: 400 }
    );
  }

  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Verify user owns this agent's company
  const companies = getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === agent.company_id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  addCustomSkill(agentId, skill.trim(), userId);

  return NextResponse.json({ added: skill.trim() });
}

// DELETE: Remove a custom skill
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, skill } = (await request.json()) as {
    agentId: string;
    skill: string;
  };

  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const companies = getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === agent.company_id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  removeCustomSkill(agentId, skill);
  return NextResponse.json({ removed: skill });
}
