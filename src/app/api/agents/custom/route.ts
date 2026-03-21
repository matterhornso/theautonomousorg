import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCompany,
  getCompaniesByUser,
  createAgent,
  getAgentRoster,
  createTask,
} from "@/lib/db";
import type { Analysis } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId, name, description, instructions, skills, connectors } =
      (await request.json()) as {
        companyId: string;
        name: string;
        description: string;
        instructions: string;
        skills: string[];
        connectors: string[];
      };

    // Verify user owns this company
    const companies = getCompaniesByUser(userId);
    const company = companies.find((c) => c.id === companyId);
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Build system prompt for custom agent
    const roster = getAgentRoster(companyId);
    const rosterList = roster.map((a) => `- @${a.role}`).join("\n");

    const analysis: Analysis | null = company.analysis_json
      ? JSON.parse(company.analysis_json)
      : null;

    const systemPrompt = `You are the ${name} Agent for ${company.name}.

## Your Role
${description}

${instructions ? `## Custom Instructions\n${instructions}` : ""}

## Company Context
- **Company:** ${company.name}
- **Industry:** ${company.industry || "Unknown"}
- **What they do:** ${company.description || "Unknown"}
- **Stage:** ${company.stage || "Unknown"}

## Your Skills
${skills.map((s) => `- ${s}`).join("\n") || "General expertise in your domain."}

## Your Connectors
${connectors.map((c) => `- ${c}`).join("\n") || "Standard tools for your role."}

## Other Agents on This Team
${rosterList || "You are the only agent currently active."}

To request help from another agent, use @AgentRole in your response. The system will route your request.

## Guidelines
- Be proactive — don't just answer questions, suggest next steps
- Be specific — give concrete recommendations
- Remember context — you have persistent memory across conversations
- Collaborate — use other agents when their expertise is needed
- Be honest about what you don't know or can't do`;

    const agent = createAgent({
      company_id: companyId,
      role: name,
      system_prompt: systemPrompt,
      company_context: JSON.stringify({
        name: company.name,
        industry: company.industry,
        description: company.description,
        stage: company.stage,
      }),
      skills_json: JSON.stringify(skills),
      connectors_json: JSON.stringify(connectors),
    });

    // Create an initial introduction task
    createTask({
      agent_id: agent.id,
      type: "introduction",
      title: `Initial Analysis & Recommendations`,
      input_json: `You are the ${name} Agent for ${company.name} (${company.industry || "unknown industry"}). ${company.description || ""}

Introduce yourself and provide an initial analysis:
1. Based on the company context, identify the top 3 ways you can add value in your role as ${name}
2. Suggest specific first actions you'd take
3. Ask 2-3 clarifying questions that would help you be more effective

Be proactive and specific.`,
    });

    // Trigger task processing
    fetch(`${request.nextUrl.origin}/api/tasks/process`, {
      method: "POST",
    }).catch(() => {});

    return NextResponse.json({
      id: agent.id,
      role: agent.role,
      status: agent.status,
      skills,
      connectors,
    });
  } catch (error) {
    console.error("Custom agent error:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
