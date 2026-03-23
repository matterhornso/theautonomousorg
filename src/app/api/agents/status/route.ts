import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCompaniesByUser,
  getAgentsByCompany,
  getMemory,
  getCustomSkills,
  getTasksByAgent,
  getAgentActions,
  getConversationsByAgent,
  getMessages,
  getUserApiKeys,
} from "@/lib/db";
import { getToolkit } from "@/lib/mcp/registry";
import { suggestedPlatforms } from "@/lib/suggested-platforms";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json(
      { error: "companyId required" },
      { status: 400 }
    );
  }

  const companies = getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const agents = getAgentsByCompany(companyId);
  const userKeys = getUserApiKeys(companyId);
  const connectedServiceNames = userKeys.map((k) => k.display_name);

  const result = agents.map((agent) => {
    const memory = getMemory(agent.id);
    const customSkills = getCustomSkills(agent.id);
    const tasks = getTasksByAgent(agent.id);
    const actions = getAgentActions(agent.id, 10);
    const conversations = getConversationsByAgent(agent.id);

    // Count total messages across all conversations
    let messageCount = 0;
    for (const conv of conversations.slice(0, 10)) {
      const msgs = getMessages(conv.id);
      messageCount += msgs.length;
    }

    // Get built-in skills from registry
    const toolkit = getToolkit(agent.role);
    const builtInSkills = toolkit?.skills || [];

    // Find which connected services are relevant to this agent
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
      conversationCount: conversations.length,
      messageCount,
    };
  });

  return NextResponse.json(result);
}
