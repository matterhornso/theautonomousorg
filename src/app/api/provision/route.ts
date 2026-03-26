import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCompany, createAgent, createTask } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/prompts";
import { agentRoles } from "@/app/data";
import { getTaskTemplatesForRole } from "@/lib/task-templates";
import type { Analysis } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    const { analysis, selectedRoles } = (await request.json()) as {
      analysis: Analysis;
      selectedRoles: string[];
    };

    if (!analysis?.company?.name || !selectedRoles?.length) {
      return NextResponse.json(
        { error: "Missing analysis or selected roles" },
        { status: 400 }
      );
    }

    // Create company record linked to authenticated user
    const company = await createCompany({
      name: analysis.company.name,
      url: analysis.company.description || "",
      user_id: userId ?? undefined,
      industry: analysis.company.industry,
      description: analysis.company.description,
      stage: analysis.company.stage,
      analysis_json: JSON.stringify(analysis),
    });

    // Create agents for each selected role
    const agents: { id: string; role: string; status: string; skills_json: string | null; connectors_json: string | null }[] = [];
    for (const role of selectedRoles) {
      const roleData = agentRoles.find((r) => r.title === role);

      // Build a preliminary roster (will be updated as agents are created)
      const roster = agents.map((a) => ({ role: a.role, id: a.id }));
      // Add future agents too so everyone knows about the full team
      const fullRoster = selectedRoles.map((r) => ({
        role: r,
        id: agents.find((a) => a.role === r)?.id || "pending",
      }));

      const systemPrompt = await buildSystemPrompt(role, analysis, fullRoster);

      const agent = await createAgent({
        company_id: company.id,
        role,
        system_prompt: systemPrompt,
        company_context: JSON.stringify(analysis.company),
        skills_json: JSON.stringify(roleData?.skills || []),
        connectors_json: JSON.stringify(roleData?.connectors || []),
      });

      agents.push(agent);

      // Enqueue proactive tasks for this agent
      const taskTemplates = getTaskTemplatesForRole(role, analysis);
      for (const template of taskTemplates) {
        await createTask({
          agent_id: agent.id,
          type: template.type,
          title: template.title,
          input_json: template.prompt,
        });
      }
    }

    // Trigger task processing (fire-and-forget)
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/tasks/process`, { method: "POST" }).catch(() => {});

    return NextResponse.json({
      companyId: company.id,
      agents: agents.map((a) => ({
        id: a.id,
        role: a.role,
        status: a.status,
        skills: JSON.parse(a.skills_json || "[]"),
        connectors: JSON.parse(a.connectors_json || "[]"),
      })),
    });
  } catch (error) {
    console.error("Provision error:", error);
    return NextResponse.json(
      { error: "Failed to provision agents" },
      { status: 500 }
    );
  }
}
