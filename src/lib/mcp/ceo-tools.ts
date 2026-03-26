/**
 * CEO Agent Tools
 *
 * The CEO agent has unique tools that no other agent has:
 * - query_all_agents: Get status from every agent in the company (parallelized)
 * - get_company_metrics: Aggregate company-wide metrics
 * - delegate_task: Create tasks for other agents
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getAgentsByCompany,
  getActivityFeed,
  getTasksByCompany,
  getUsage,
  getMemory,
  createTask,
  logAgentAction,
} from "@/lib/db";

const client = new Anthropic();

// Track delegation count per conversation to prevent runaway loops
const delegationCounts = new Map<string, number>();
const MAX_DELEGATIONS_PER_QUERY = 10;

export function resetDelegationCount(conversationId: string) {
  delegationCounts.delete(conversationId);
}

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
  {
    name: "delegate_task",
    description:
      "Create a task for another agent in the company. Use this after reviewing agent status or metrics to assign follow-up work. For example, if Sales pipeline is stale, delegate a prospecting task to the Sales agent.",
    input_schema: {
      type: "object" as const,
      properties: {
        target_agent_role: {
          type: "string" as const,
          description:
            'The role of the agent to delegate to, e.g. "Sales", "Marketing", "Strategy"',
        },
        task_title: {
          type: "string" as const,
          description:
            'Brief title for the task, e.g. "Run weekly pipeline review"',
        },
        task_description: {
          type: "string" as const,
          description: "Detailed instructions for the agent to follow",
        },
        priority: {
          type: "string" as const,
          enum: ["low", "normal", "high"],
          description: 'Task priority (default: "normal")',
        },
      },
      required: ["target_agent_role", "task_title"],
    },
  },
];

export async function executeCeoTool(
  toolName: string,
  input: Record<string, unknown>,
  companyId: string,
  conversationId?: string
): Promise<string> {
  try {
    switch (toolName) {
      case "query_all_agents": {
        const question = (input.question as string) || "What is your current status?";
        const agents = await getAgentsByCompany(companyId);

        if (agents.length === 0) {
          return "No agents are currently active for this company.";
        }

        // Parallelize Haiku calls for all agents (except CEO)
        const nonCeoAgents = agents.filter((a) => a.role !== "CEO");

        const results = await Promise.allSettled(
          nonCeoAgents.map(async (agent) => {
            const memories = await getMemory(agent.id);
            const memoryContext = memories
              .slice(0, 5)
              .map((m) => `${m.key}: ${m.value}`)
              .join("\n");

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
            return { role: agent.role, text };
          })
        );

        const responses: string[] = [];
        for (const r of results) {
          if (r.status === "fulfilled") {
            responses.push(`**@${r.value.role}:** ${r.value.text}`);
          } else {
            // Extract role from the error — find matching agent by index
            const idx = results.indexOf(r);
            const role = nonCeoAgents[idx]?.role || "Unknown";
            responses.push(`**@${role}:** Unable to reach this agent right now.`);
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

      case "delegate_task": {
        const targetRole = input.target_agent_role as string;
        const taskTitle = input.task_title as string;
        const taskDescription = (input.task_description as string) || "";
        const priority = (input.priority as string) || "normal";

        if (!targetRole || !taskTitle) {
          return "Error: target_agent_role and task_title are required.";
        }

        // Prevent self-delegation
        if (targetRole === "CEO") {
          return "Cannot delegate tasks to yourself. Choose another agent role.";
        }

        // Check delegation limit
        const convId = conversationId || "default";
        const currentCount = delegationCounts.get(convId) || 0;
        if (currentCount >= MAX_DELEGATIONS_PER_QUERY) {
          return `Delegation limit reached (${MAX_DELEGATIONS_PER_QUERY} per conversation). Review existing delegated tasks before creating more.`;
        }

        // Find target agent in the same company
        const agents = await getAgentsByCompany(companyId);
        const targetAgent = agents.find(
          (a) => a.role.toLowerCase() === targetRole.toLowerCase()
        );

        if (!targetAgent) {
          const availableRoles = agents
            .filter((a) => a.role !== "CEO")
            .map((a) => a.role)
            .join(", ");
          return `No ${targetRole} agent found in this company. Available agents: ${availableRoles}`;
        }

        // Create the task
        const task = await createTask({
          agent_id: targetAgent.id,
          type: "ceo_delegation",
          title: taskTitle,
          input_json: taskDescription
            ? `CEO delegated: ${taskDescription}`
            : `CEO delegated this task. Priority: ${priority}`,
        });

        // Log the delegation
        await logAgentAction({
          agent_id: targetAgent.id,
          action_type: "task_delegated",
          title: `CEO delegated: ${taskTitle}`,
          detail: `Priority: ${priority}. ${taskDescription.slice(0, 200)}`,
          source: "ceo_delegation",
        });

        // Increment delegation counter
        delegationCounts.set(convId, currentCount + 1);

        return `Task delegated to **@${targetAgent.role}**: "${taskTitle}" (${priority} priority). Task ID: ${task.id}. The agent will process this in the background.`;
      }

      default:
        return `Unknown CEO tool: ${toolName}`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
