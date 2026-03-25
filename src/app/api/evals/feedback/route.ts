import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createEval, getEvalsByAgent } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/evals/feedback
 * Save user thumbs up/down feedback for a message.
 * Creates an eval record with user feedback if none exists,
 * or updates the most recent eval for that agent.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { agentId, feedback, messageContent, conversationId } = body;

  if (!agentId || !["thumbs_up", "thumbs_down"].includes(feedback)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Try to find a recent eval for this agent+message to update
  const recentEvals = await getEvalsByAgent(agentId, 10);
  const matchingEval = recentEvals.find(
    (e) =>
      e.response_evaluated &&
      messageContent &&
      e.response_evaluated.slice(0, 100) === messageContent.slice(0, 100)
  );

  if (matchingEval) {
    const { updateUserFeedback } = await import("@/lib/db");
    await updateUserFeedback(matchingEval.id, feedback);
    return NextResponse.json({ success: true, evalId: matchingEval.id });
  }

  // No matching eval found — create a new one with just user feedback
  const evalRecord = await createEval({
    agent_id: agentId,
    conversation_id: conversationId,
    eval_type: "user_feedback",
    scores: JSON.stringify({ relevance: 0, completeness: 0, actionability: 0, role_specificity: 0, overall: 0 }),
    user_feedback: feedback,
    response_evaluated: messageContent?.slice(0, 500),
  });

  return NextResponse.json({ success: true, evalId: evalRecord.id });
}
