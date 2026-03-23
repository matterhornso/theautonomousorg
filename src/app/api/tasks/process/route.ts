import { NextResponse } from "next/server";
import { processNextTask } from "@/lib/task-processor";

export async function POST() {
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
