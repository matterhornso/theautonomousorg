import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  getNextQueuedTask,
  updateTaskStatus,
  getAgent,
  setMemory,
  incrementUsage,
} from "@/lib/db";

const client = new Anthropic();
const MAX_RETRIES = 3;

export async function POST() {
  try {
    const task = getNextQueuedTask();
    if (!task) {
      return NextResponse.json({ message: "No tasks in queue" });
    }

    // Check retry limit
    if (task.retry_count >= MAX_RETRIES) {
      updateTaskStatus(task.id, "failed", {
        error_message: `Failed after ${MAX_RETRIES} attempts`,
      });
      return NextResponse.json({
        message: "Task exceeded retry limit",
        taskId: task.id,
      });
    }

    // Mark as running
    updateTaskStatus(task.id, "running");

    const agent = getAgent(task.agent_id);
    if (!agent) {
      updateTaskStatus(task.id, "failed", {
        error_message: "Agent not found",
      });
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Execute the task using Claude
    const prompt = task.input_json || "";

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: agent.system_prompt,
      messages: [
        {
          role: "user",
          content: `Execute this task:\n\n${task.title}\n\n${prompt}`,
        },
      ],
    });

    const resultText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Mark as done with result
    updateTaskStatus(task.id, "done", { result_json: resultText });

    // Track usage
    incrementUsage(agent.company_id, "task_count");

    // Store result as agent memory for future conversations
    setMemory(
      task.agent_id,
      `task_${task.type}`,
      `Completed "${task.title}": ${resultText.slice(0, 500)}`
    );

    return NextResponse.json({
      message: "Task completed",
      taskId: task.id,
      agentRole: agent.role,
    });
  } catch (error) {
    console.error("Task processing error:", error);

    // If we had a task running, mark it as failed
    const task = getNextQueuedTask();
    if (task && task.status === "running") {
      updateTaskStatus(task.id, "failed", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return NextResponse.json(
      { error: "Task processing failed" },
      { status: 500 }
    );
  }
}
