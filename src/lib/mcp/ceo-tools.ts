/**
 * CEO Agent Tools
 *
 * The CEO agent has unique tools that no other agent has:
 * - query_all_agents: Get status from every agent in the company
 * - get_company_metrics: Aggregate company-wide metrics
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getAgentsByCompany,
  getAgent,
  getActivityFeed,
  getTasksByCompany,
  getUsage,
  getMemory,
} from "@/lib/db";

const client = new Anthropic();

export const ceoTools: Anthropic.Tool[] = [
  {
    name: "query_all_agents",
    description:
      "Ask every agent in the company for a brief status update. Returns a consolidated summary of what each agent is working on, what they've accomplished, and any blockers. Use this to get a company-wide picture before making strategic decisions.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string" as const,
          description:
            'The question to ask all agents, e.g. "What did you accomplish this week?" or "What are your top priorities?"',
        },
      },
      required: ["question"],
    },
  },
  {
    name: "get_company_metrics",
    description:
      "Get aggregated company metrics: total agents active, tasks completed/failed/pending, messages exchanged this month, recent activity feed. Use this for data-driven executive decisions.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: {
          type: "string" as const,
          description: 'Time period: "today", "week", "month" (default: "week")',
        },
      },
    },
  },
];

export async function executeCeoTool(
  toolName: string,
  input: Record<string, unknown>,
  companyId: string
): Promise<string> {
  try {
    switch (toolName) {
      case "query_all_agents": {
        const question = (input.question as string) || "What is your current status?";
        const agents = await getAgentsByCompany(companyId);

        if (agents.length === 0) {
          return "No agents are currently active for this company.";
        }

        const responses: string[] = [];

        for (const agent of agents) {
          if (agent.role === "CEO") continue; // Don't query yourself

          // Get agent's memory for context
          const memories = await getMemory(agent.id);
          const memoryContext = memories
            .slice(0, 5)
            .map((m) => `${m.key}: ${m.value}`)
            .join("\n");

          // Quick status query via Haiku (fast + cheap)
          try {
            const result = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 300,
              system: `You are the ${agent.role} Agent. Give a brief 2-3 sentence status update. Be specific about what you've done and what's next.\n\nYour recent memory:\n${memoryContext || "No recent memory."}`,
              messages: [
                { role: "user", content: `CEO is asking: ${question}` },
              ],
            });

            const text =
              result.content[0].type === "text" ? result.content[0].text : "";
            responses.push(`**@${agent.role}:** ${text}`);
          } catch {
            responses.push(
              `**@${agent.role}:** Unable to reach this agent right now.`
            );
          }
        }

        return `## Agent Status Report\n\n${responses.join("\n\n")}`;
      }

      case "get_company_metrics": {
        const agents = await getAgentsByCompany(companyId);
        const allTasks = await getTasksByCompany(companyId);
        const usage = await getUsage(companyId);
        const activity = await getActivityFeed(companyId, 20);

        const tasksDone = allTasks.filter((t) => t.status === "done").length;
        const tasksFailed = allTasks.filter((t) => t.status === "failed").length;
        const tasksQueued = allTasks.filter(
          (t) => t.status === "queued" || t.status === "running"
        ).length;

        const recentActivity = activity
          .slice(0, 10)
          .map(
            (a) =>
              `- ${a.agent_role}: ${a.title} (${a.status})`
          )
          .join("\n");

        return `## Company Metrics

**Team Size:** ${agents.length} agents active
**Roles:** ${agents.map((a) => a.role).join(", ")}

**Task Pipeline:**
- Completed: ${tasksDone}
- Failed: ${tasksFailed}
- In Progress: ${tasksQueued}
- Success Rate: ${allTasks.length > 0 ? Math.round((tasksDone / allTasks.length) * 100) : 0}%

**This Month:**
- Tasks: ${usage.task_count}
- Messages: ${usage.message_count}

**Recent Activity:**
${recentActivity || "No recent activity."}`;
      }

      default:
        return `Unknown CEO tool: ${toolName}`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
