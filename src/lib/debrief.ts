/**
 * Daily Debrief Generator
 *
 * Aggregates all agent activity from the last 24 hours and produces
 * a structured executive summary using Claude Haiku.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getActivityFeed,
  getAgentsByCompany,
  getTasksByCompany,
  getUsage,
  createDebrief,
  type Debrief,
} from "./db";

const client = new Anthropic();

export async function generateDebrief(
  companyId: string,
  userId: string
): Promise<Debrief> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const agents = getAgentsByCompany(companyId);
  const allTasks = getTasksByCompany(companyId);
  const activity = getActivityFeed(companyId, 50);
  const usage = getUsage(companyId);

  // Filter to last 24h
  const recentTasks = allTasks.filter(
    (t) => new Date(t.created_at) >= yesterday
  );
  const tasksDone = recentTasks.filter((t) => t.status === "done");
  const tasksFailed = recentTasks.filter((t) => t.status === "failed");

  const recentActivity = activity
    .filter((a) => new Date(a.created_at) >= yesterday)
    .map((a) => `- ${a.agent_role}: ${a.title} (${a.status})`)
    .join("\n");

  // Generate summary with Claude Haiku (fast + cheap)
  const result = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system:
      "You are an executive assistant producing a daily debrief for a CEO. Be concise, specific, and actionable. Use bullet points. Include numbers where relevant.",
    messages: [
      {
        role: "user",
        content: `Generate a daily debrief for the last 24 hours.

Company has ${agents.length} AI agents: ${agents.map((a) => a.role).join(", ")}

Tasks completed yesterday: ${tasksDone.length}
Tasks failed: ${tasksFailed.length}
${tasksDone.length > 0 ? "Completed tasks:\n" + tasksDone.map((t) => `- ${t.title}`).join("\n") : ""}
${tasksFailed.length > 0 ? "Failed tasks:\n" + tasksFailed.map((t) => `- ${t.title}: ${t.error_message || "unknown error"}`).join("\n") : ""}

Monthly usage so far: ${usage.task_count} tasks, ${usage.message_count} messages

Recent activity:
${recentActivity || "No activity in the last 24 hours."}

Format as:
## Daily Debrief — [date]

### What Happened
- bullet points of key accomplishments

### Attention Needed
- any failures, blockers, or risks

### Recommendations
- 2-3 actionable next steps

### Metrics
- key numbers at a glance`,
      },
    ],
  });

  const content =
    result.content[0].type === "text"
      ? result.content[0].text
      : "Debrief generation failed.";

  return createDebrief({
    company_id: companyId,
    user_id: userId,
    content,
    period_start: yesterday.toISOString(),
    period_end: now.toISOString(),
    delivered_via: "dashboard",
  });
}
