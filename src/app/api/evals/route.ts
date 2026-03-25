import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getEvalsByCompany,
  getEvalsByAgent,
  getAverageScores,
  getAgentsByCompany,
  getCompany,
  getAgent,
  createEval,
  createEvalRun,
  updateEvalRun,
  getUserFeedbackSummary,
  getFlaggedEvals,
  getEvalRuns,
} from "@/lib/db";
import { judgeResponse, runTestSuite } from "@/lib/eval-judge";
import { defaultTestSuites } from "@/lib/eval-test-suites";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const agentId = searchParams.get("agentId");

  if (agentId) {
    const evals = await getEvalsByAgent(agentId, 50);
    const avgScores = await getAverageScores(agentId, 7);
    const prevAvg = await getAverageScores(agentId, 14);

    return NextResponse.json({
      evals,
      averageScores: avgScores,
      previousPeriodScores: prevAvg,
    });
  }

  if (companyId) {
    const company = await getCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const agents = await getAgentsByCompany(companyId);
    const agentScores = await Promise.all(
      agents.map(async (a) => {
        const avg = await getAverageScores(a.id, 7);
        const prevAvg = await getAverageScores(a.id, 14);
        return {
          agentId: a.id,
          role: a.role,
          currentScores: avg,
          previousScores: prevAvg,
        };
      })
    );

    const feedbackSummary = await getUserFeedbackSummary(companyId);
    const flagged = await getFlaggedEvals(companyId, 10);
    const recentEvals = await getEvalsByCompany(companyId, 20);
    const runs = await getEvalRuns(companyId, 5);

    // Calculate company-wide average
    const activeAgents = agentScores.filter((a) => a.currentScores.count > 0);
    const companyAvg =
      activeAgents.length > 0
        ? Math.round(
            (activeAgents.reduce((s, a) => s + a.currentScores.overall, 0) /
              activeAgents.length) *
              10
          ) / 10
        : 0;

    return NextResponse.json({
      companyAverage: companyAvg,
      agentScores,
      feedbackSummary,
      flaggedEvals: flagged,
      recentEvals,
      runs,
    });
  }

  return NextResponse.json({ error: "companyId or agentId required" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "feedback") {
    const { evalId, feedback } = body;
    if (!evalId || !["thumbs_up", "thumbs_down"].includes(feedback)) {
      return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
    }

    const { updateUserFeedback } = await import("@/lib/db");
    await updateUserFeedback(evalId, feedback);
    return NextResponse.json({ success: true });
  }

  if (action === "run_suite") {
    const { companyId } = body;
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }

    const company = await getCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const agents = await getAgentsByCompany(companyId);
    const run = await createEvalRun(companyId, "manual");

    // Run test suites async (non-blocking) — return immediately
    runSuiteInBackground(run.id, company.name, agents).catch(() => {});

    return NextResponse.json({ runId: run.id, status: "started" });
  }

  if (action === "judge") {
    const { agentId, userMessage, agentResponse } = body;
    if (!agentId || !userMessage || !agentResponse) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const agent = await getAgent(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const company = await getCompany(agent.company_id);
    const result = await judgeResponse({
      agentRole: agent.role,
      companyName: company?.name || "Unknown",
      userMessage,
      agentResponse,
    });

    const evalRecord = await createEval({
      agent_id: agentId,
      eval_type: "response_quality",
      scores: JSON.stringify(result.scores),
      judge_reasoning: result.reasoning,
      prompt_used: userMessage.slice(0, 500),
      response_evaluated: agentResponse.slice(0, 500),
    });

    return NextResponse.json({ eval: evalRecord, scores: result.scores, reasoning: result.reasoning });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function runSuiteInBackground(
  runId: string,
  companyName: string,
  agents: { id: string; role: string; system_prompt: string }[]
) {
  try {
    const allResults: Record<string, unknown> = {};

    for (const agent of agents) {
      const roleTests = defaultTestSuites.filter(
        (t) => t.role === agent.role
      );
      if (roleTests.length === 0) continue;

      const result = await runTestSuite({
        agentId: agent.id,
        agentRole: agent.role,
        companyName,
        systemPrompt: agent.system_prompt,
        testPrompts: roleTests.map((t) => ({
          name: t.name,
          prompt: t.prompt,
          expectedQualities: t.expectedQualities,
        })),
      });

      // Save individual eval records
      for (const r of result.results) {
        await createEval({
          agent_id: agent.id,
          eval_type: "test_suite",
          scores: JSON.stringify(r.scores),
          judge_reasoning: r.reasoning,
          prompt_used: r.prompt,
          response_evaluated: r.response.slice(0, 500),
        });
      }

      allResults[agent.role] = {
        averageScores: result.averageScores,
        testCount: result.results.length,
      };
    }

    await updateEvalRun(runId, {
      completed_at: new Date().toISOString(),
      results: JSON.stringify(allResults),
      status: "completed",
    });
  } catch (error) {
    await updateEvalRun(runId, {
      completed_at: new Date().toISOString(),
      results: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      status: "failed",
    });
  }
}
