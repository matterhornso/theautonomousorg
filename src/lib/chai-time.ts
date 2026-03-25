/**
 * Chai Time — Daily agent sync engine.
 *
 * At a configured time each day, all agents in a company exchange
 * context: each agent produces a standup summary, then receives
 * personalised cross-updates distilled from teammates' summaries.
 * Updates are stored as memory entries so they persist.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getAgentsByCompany,
  getAgentActions,
  getMemory,
  getTasksByAgent,
  setMemory,
  logAgentAction,
  createChaiTimeSession,
  updateChaiTimeSession,
  updateChaiTimeConfig,
  getCompany,
} from "./db";
import type { ChaiTimeSession } from "./db";

const client = new Anthropic();

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export interface AgentSummary {
  agentId: string;
  role: string;
  summary: string;
}

export interface CrossUpdate {
  fromRole: string;
  toRole: string;
  update: string;
}

export interface ChaiTimeResult {
  session: ChaiTimeSession;
  summaries: AgentSummary[];
  crossUpdates: CrossUpdate[];
}

export async function runChaiTime(companyId: string): Promise<ChaiTimeResult> {
  // 1. Create session
  const session = await createChaiTimeSession(companyId);

  try {
    const company = await getCompany(companyId);
    const companyName = company?.name ?? "Company";

    // 2. Get all active agents
    const agents = (await getAgentsByCompany(companyId)).filter(
      (a) => a.status === "active"
    );

    if (agents.length === 0) {
      await updateChaiTimeSession(session.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        agent_summaries: "[]",
        cross_updates: "[]",
      });
      return { session, summaries: [], crossUpdates: [] };
    }

    // 3. Gather context for each agent (last 24h)
    const agentContexts = await Promise.all(
      agents.map(async (agent) => {
        const actions = await getAgentActions(agent.id, 20);
        const memory = await getMemory(agent.id);
        const tasks = await getTasksByAgent(agent.id);
        const recentTasks = tasks.filter(
          (t) =>
            t.status === "done" &&
            t.completed_at &&
            new Date(t.completed_at).getTime() >
              Date.now() - 24 * 60 * 60 * 1000
        );
        const recentActions = actions.filter(
          (a) =>
            new Date(a.created_at).getTime() >
            Date.now() - 24 * 60 * 60 * 1000
        );

        return {
          agent,
          actions: recentActions,
          memory,
          tasks: recentTasks,
        };
      })
    );

    // 4. Generate standup summaries (parallel)
    const summaries: AgentSummary[] = await Promise.all(
      agentContexts.map(async (ctx) => {
        const actionsText =
          ctx.actions.length > 0
            ? ctx.actions
                .map((a) => `- [${a.action_type}] ${a.title}`)
                .join("\n")
            : "No actions logged.";
        const tasksText =
          ctx.tasks.length > 0
            ? ctx.tasks.map((t) => `- ${t.title} (done)`).join("\n")
            : "No tasks completed.";
        const memoryText =
          ctx.memory.length > 0
            ? ctx.memory
                .slice(0, 10)
                .map((m) => `- ${m.key}: ${m.value.slice(0, 200)}`)
                .join("\n")
            : "No memory entries.";

        const prompt = `You are the ${ctx.agent.role} Agent for ${companyName}. Here's what you've done in the last 24 hours:

Actions:
${actionsText}

Completed Tasks:
${tasksText}

Current Memory/Context:
${memoryText}

Write a brief standup update (2-3 sentences) covering:
- What you accomplished
- Key information other agents should know
- Any blockers or needs from other agents

Be specific and concise. If nothing notable happened, say so briefly.`;

        try {
          const result = await client.messages.create({
            model: HAIKU_MODEL,
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          });

          const summary =
            result.content[0].type === "text"
              ? result.content[0].text
              : "No update available.";

          return {
            agentId: ctx.agent.id,
            role: ctx.agent.role,
            summary,
          };
        } catch {
          return {
            agentId: ctx.agent.id,
            role: ctx.agent.role,
            summary: "Unable to generate summary.",
          };
        }
      })
    );

    // 5. Generate cross-updates for each agent (parallel)
    const allCrossUpdates: CrossUpdate[] = [];

    await Promise.all(
      agents.map(async (agent) => {
        const otherSummaries = summaries
          .filter((s) => s.agentId !== agent.id)
          .map((s) => `**${s.role}:** ${s.summary}`)
          .join("\n\n");

        if (!otherSummaries) return;

        const prompt = `You are the ${agent.role} Agent. Here's what your teammates shared at Chai Time:

${otherSummaries}

Based on these updates, what 1-3 things are most relevant to YOUR role as ${agent.role}?
How should this affect your work? Be specific and actionable.

Output as a JSON array: [{"key": "chai_time_YYYY-MM-DD_<sourceRole>", "value": "what you learned and how it affects your work"}]
Use today's date. Only output the JSON array, nothing else.`;

        try {
          const result = await client.messages.create({
            model: HAIKU_MODEL,
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }],
          });

          const text =
            result.content[0].type === "text" ? result.content[0].text : "[]";

          // Parse the JSON response
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const updates = JSON.parse(jsonMatch[0]) as {
              key: string;
              value: string;
            }[];
            for (const update of updates) {
              // Store as memory
              await setMemory(agent.id, update.key, update.value);

              // Extract source role from key
              const fromRoleMatch = update.key.match(
                /chai_time_\d{4}-\d{2}-\d{2}_(.+)$/
              );
              const fromRole = fromRoleMatch ? fromRoleMatch[1] : "Unknown";

              allCrossUpdates.push({
                fromRole,
                toRole: agent.role,
                update: update.value,
              });
            }
          }
        } catch {
          // Non-fatal — skip cross-updates for this agent
        }
      })
    );

    // 6. Log action for each agent
    await Promise.all(
      agents.map((agent) =>
        logAgentAction({
          agent_id: agent.id,
          action_type: "chai_time",
          title: "Chai Time: synced with team",
          detail: `Exchanged context with ${agents.length - 1} other agents`,
          source: "system",
        })
      )
    );

    // 7. Update session
    await updateChaiTimeSession(session.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      agent_summaries: JSON.stringify(summaries),
      cross_updates: JSON.stringify(allCrossUpdates),
    });

    // 8. Update last_run_at
    await updateChaiTimeConfig(companyId, {
      last_run_at: new Date().toISOString(),
    });

    return { session: { ...session, status: "completed" }, summaries, crossUpdates: allCrossUpdates };
  } catch (error) {
    await updateChaiTimeSession(session.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}
