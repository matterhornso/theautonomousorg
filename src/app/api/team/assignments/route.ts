import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assignAgent, unassignAgent, getAgentAssignments, getAgent } from "@/lib/db";
import { assertCompanyOwnership } from "@/lib/auth-helpers";

/** Resolve the agent, confirm the caller owns its company, or return an error response. */
async function requireAgentOwnership(userId: string, agentId: string | null) {
  if (!agentId) {
    return { ok: false as const, response: NextResponse.json({ error: "agentId required" }, { status: 400 }) };
  }
  const agent = await getAgent(agentId);
  if (!agent) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const ownership = await assertCompanyOwnership(userId, agent.company_id);
  if (!ownership.ok) return { ok: false as const, response: ownership.response };
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = request.nextUrl.searchParams.get("agentId");
  const guard = await requireAgentOwnership(userId, agentId);
  if (!guard.ok) return guard.response;

  const assignments = await getAgentAssignments(agentId!);
  return NextResponse.json({ agentId, assignedUsers: assignments });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, targetUserId } = (await request.json()) as {
    agentId: string;
    targetUserId: string;
  };

  const guard = await requireAgentOwnership(userId, agentId);
  if (!guard.ok) return guard.response;

  await assignAgent(agentId, targetUserId, userId);
  return NextResponse.json({ assigned: true });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, targetUserId } = (await request.json()) as {
    agentId: string;
    targetUserId: string;
  };

  const guard = await requireAgentOwnership(userId, agentId);
  if (!guard.ok) return guard.response;

  await unassignAgent(agentId, targetUserId);
  return NextResponse.json({ unassigned: true });
}
