import Anthropic from "@anthropic-ai/sdk";
import {
  getNextQueuedTask,
  updateTaskStatus,
  logAgentAction,
  getAgent,
  setMemory,
  incrementUsage,
} from "@/lib/db";

const client = new Anthropic();
const MAX_RETRIES = 3;

export interface ProcessResult {
  status: "completed" | "no_tasks" | "retry_exceeded" | "agent_not_found" | "error";
  taskId?: string;
  agentRole?: string;
  error?: string;
}

/**
 * Process the next queued task. Can be called from API routes,
 * webhook handlers, or the worker process — no HTTP round-trip needed.
 */
export async function processNextTask(): Promise<ProcessResult> {
  const task = getNextQueuedTask();
  if (!task) {
    return { status: "no_tasks" };
  }

  // Check retry limit
  if (task.retry_count >= MAX_RETRIES) {
    updateTaskStatus(task.id, "failed", {
      error_message: `Failed after ${MAX_RETRIES} attempts`,
    });
    return { status: "retry_exceeded", taskId: task.id };
  }

  // Mark as running
  updateTaskStatus(task.id, "running");

  try {
    const agent = getAgent(task.agent_id);
    if (!agent) {
      updateTaskStatus(task.id, "failed", {
        error_message: "Agent not found",
      });
      return { status: "agent_not_found", taskId: task.id };
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

    // Log agent action
    logAgentAction({
      agent_id: task.agent_id,
      action_type: "task_completed",
      title: `Completed: ${task.title}`,
      detail: resultText.slice(0, 200),
      source: "task_processor",
    });

    // Track usage
    incrementUsage(agent.company_id, "task_count");

    // Store result as agent memory for future conversations
    setMemory(
      task.agent_id,
      `task_${task.type}`,
      `Completed "${task.title}": ${resultText.slice(0, 500)}`
    );

    return {
      status: "completed",
      taskId: task.id,
      agentRole: agent.role,
    };
  } catch (error) {
    console.error("Task processing error:", error);
    updateTaskStatus(task.id, "failed", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      status: "error",
      taskId: task.id,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
