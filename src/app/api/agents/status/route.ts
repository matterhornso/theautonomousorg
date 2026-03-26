import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getAgentsByCompany,
  getUserApiKeys,
  getMemoryByAgentIds,
  getCustomSkillsByAgentIds,
  getTasksByAgentIds,
  getActionsByAgentIds,
  getConversationCountsByAgentIds,
} from "@/lib/db";
import { assertCompanyOwnership } from "@/lib/auth-helpers";
import { getToolkit } from "@/lib/mcp/registry";
import { suggestedPlatforms } from "@/lib/suggested-platforms";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    console.error("[agents/status] No userId from auth — Clerk may not be passing credentials");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  console.log(`[agents/status] userId=${userId}, companyId=${companyId}`);

  const ownership = await assertCompanyOwnership(userId, companyId);
  if (!ownership.ok) {
    console.error(`[agents/status] Ownership check failed for userId=${userId}, companyId=${companyId}`);
    return ownership.response;
  }

  const agents = await getAgentsByCompany(ownership.companyId);
  console.log(`[agents/status] Found ${agents.length} agents for companyId=${ownership.companyId}`);
  const agentIds = agents.map((a) => a.id);

  // Batch all queries (6 queries total instead of 225)
  const [memoryMap, skillsMap, tasksMap, actionsMap, countsMap] = await Promise.all([
    getMemoryByAgentIds(agentIds),
    getCustomSkillsByAgentIds(agentIds),
    getTasksByAgentIds(agentIds),
    getActionsByAgentIds(agentIds, 10),
    getConversationCountsByAgentIds(agentIds),
  ]);

  const userKeys = await getUserApiKeys(ownership.companyId);
  const connectedServiceNames = userKeys.map((k) => k.display_name);

  const result = agents.map((agent) => {
    const memory = memoryMap[agent.id] || [];
    const customSkills = skillsMap[agent.id] || [];
    const tasks = tasksMap[agent.id] || [];
    const actions = actionsMap[agent.id] || [];
    const counts = countsMap[agent.id] || { conversations: 0, messages: 0 };

    const toolkit = getToolkit(agent.role);
    // For custom agents without a registry toolkit, fall back to skills_json
    // or provide a default set of generic skills
    const defaultCustomSkills = ["Research", "Writing", "Analysis", "Communication", "Planning"];
    const builtInSkills = toolkit?.skills
      || JSON.parse(agent.skills_json || "null")
      || defaultCustomSkills;

    const relevantPlatforms = suggestedPlatforms.filter((p) =>
      p.relevantAgents.includes(agent.role)
    );
    const agentConnectedServices = connectedServiceNames.filter((name) =>
      relevantPlatforms.some((p) => p.displayName === name)
    );

    return {
      id: agent.id,
      role: agent.role,
      status: agent.status,
      system_prompt: agent.system_prompt?.slice(0, 100) + "...",
      created_at: agent.created_at,
      memory: memory.map((m) => ({ key: m.key, value: m.value })),
      skills: builtInSkills,
      customSkills,
      tasks: tasks.map((t) => {
        const raw = t as unknown as Record<string, unknown>;
        return {
          id: t.id,
          type: t.type,
          title: t.title,
          status: t.status,
          created_at: t.created_at,
          is_recurring: raw.is_recurring ? 1 : 0,
          cron_expression: (raw.cron_expression as string) || null,
        };
      }),
      actions: actions.map((a) => ({
        title: a.title,
        action_type: a.action_type,
        created_at: a.created_at,
      })),
      connectedServices: agentConnectedServices,
      conversationCount: counts.conversations,
      messageCount: counts.messages,
    };
  });

  return NextResponse.json(result);
}
