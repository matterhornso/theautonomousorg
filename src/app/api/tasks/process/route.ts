import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { processNextTask } from "@/lib/task-processor";
import { safeEqual } from "@/lib/secure-compare";

export async function POST(request: NextRequest) {
  // Internal-only: require secret header or authenticated user
  const internalSecret = request.headers.get("x-internal-secret");
  const isInternalCall = !!internalSecret && !!process.env.INTERNAL_SECRET && safeEqual(internalSecret, process.env.INTERNAL_SECRET);

  if (!isInternalCall) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await processNextTask();

  switch (result.status) {
    case "no_tasks":
      return NextResponse.json({ message: "No tasks in queue" });
    case "retry_exceeded":
      return NextResponse.json({
        message: "Task exceeded retry limit",
        taskId: result.taskId,
      });
    case "agent_not_found":
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    case "error":
      return NextResponse.json(
        { error: "Task processing failed" },
        { status: 500 }
      );
    case "completed":
      return NextResponse.json({
        message: "Task completed",
        taskId: result.taskId,
        agentRole: result.agentRole,
      });
  }
}
