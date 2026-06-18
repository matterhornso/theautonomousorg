/**
 * Agent run feedback — closes the closed loop.
 *
 * Every chat completion (Tier 2) and inter-agent relay writes a lesson
 * with outputAccepted='unknown'. This endpoint flips that signal once a
 * human (or downstream system) reviews the output. The target agent
 * then sees the updated lesson on its next run via LessonsHelper.readRecent.
 *
 * POST /api/agents/runs/[runId]/feedback
 *   { outcome: 'approved' | 'rejected' | 'modified',
 *     modificationDetail?: string, selfCritique?: string }
 *
 * Auth: Clerk session OR internal-secret header (so an agent's afterRun
 * can self-rate without round-tripping the user).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assertCompanyOwnership } from "@/lib/auth-helpers";
import { getAgentRun } from "@/lib/agent-runs";
import { updateLessonForRun } from "@/lib/lessons";
import { safeEqual } from "@/lib/secure-compare";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  // Internal-secret bypass for agent self-rating / server-side flows.
  const internalSecret = request.headers.get("x-internal-secret");
  const isInternal =
    !!internalSecret &&
    !!process.env.INTERNAL_SECRET &&
    safeEqual(internalSecret, process.env.INTERNAL_SECRET);

  let userId: string | null = null;
  if (!isInternal) {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.userId;
  }

  const body = (await request.json().catch(() => ({}))) as {
    outcome?: "approved" | "rejected" | "modified";
    modificationDetail?: string;
    selfCritique?: string;
  };

  if (!body.outcome || !["approved", "rejected", "modified"].includes(body.outcome)) {
    return NextResponse.json(
      { error: "outcome must be 'approved' | 'rejected' | 'modified'" },
      { status: 400 }
    );
  }

  // Load the run so we can scope the lesson update by company_id.
  const run = await getAgentRun(runId);
  if (!run) {
    // No agent_runs row (pre-Tier-2 chat, or dev mode without DB). Surface
    // a clear status code rather than a generic 404 so callers can branch.
    return NextResponse.json(
      { error: "run not found — feedback requires an agent_runs row" },
      { status: 404 }
    );
  }

  // Tenant ownership check for user-initiated feedback.
  if (userId) {
    const ownership = await assertCompanyOwnership(userId, run.companyId);
    if (!ownership.ok) return ownership.response;
  }

  const { updated } = await updateLessonForRun({
    companyId: run.companyId,
    runId,
    outputAccepted: body.outcome,
    modificationDetail: body.modificationDetail,
    selfCritique: body.selfCritique,
  });

  return NextResponse.json({
    runId,
    outcome: body.outcome,
    lessonUpdated: updated === 1,
    agentRole: run.agentRole,
  });
}
