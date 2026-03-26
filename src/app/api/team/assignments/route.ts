import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assignAgent, unassignAgent, getAgentAssignments } from "@/lib/db";

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

  const assignments = await getAgentAssignments(agentId);
  return NextResponse.json({ agentId, assignedUsers: assignments });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, targetUserId } = (await request.json()) as {
    agentId: string;
    targetUserId: string;
  };

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

  await unassignAgent(agentId, targetUserId);
  return NextResponse.json({ unassigned: true });
}
