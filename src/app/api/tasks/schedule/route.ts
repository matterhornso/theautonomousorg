import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompaniesByUser, getAgent, createScheduledTask, getScheduledTasksByCompany } from "@/lib/db";
import { assertCompanyOwnership } from "@/lib/auth-helpers";
import { Cron } from "croner";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tasks = await getScheduledTasksByCompany(companyId);
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, type, title, prompt, cronExpression, scheduledAt } =
    (await request.json()) as {
      agentId: string;
      type: string;
      title: string;
      prompt: string;
      cronExpression?: string;
      scheduledAt?: string;
    };

  if (!agentId || !title) {
    return NextResponse.json({ error: "agentId and title required" }, { status: 400 });
  }

  const agent = await getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // IDOR guard: caller must own the agent's company before scheduling work on it.
  const ownership = await assertCompanyOwnership(userId, agent.company_id);
  if (!ownership.ok) return ownership.response;

  // Validate cron expression
  if (cronExpression) {
    try {
      new Cron(cronExpression);
    } catch {
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
    }
  }

  // Calculate next scheduled_at from cron
  let nextRun = scheduledAt;
  if (cronExpression && !nextRun) {
    const cron = new Cron(cronExpression);
    const next = cron.nextRun();
    nextRun = next ? next.toISOString() : undefined;
  }

  const task = await createScheduledTask({
    agent_id: agentId,
    type: type || "scheduled",
    title,
    input_json: prompt,
    scheduled_at: nextRun,
    cron_expression: cronExpression,
    is_recurring: !!cronExpression,
  });

  return NextResponse.json(task);
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, taskId } = (await request.json()) as { companyId: string; taskId: string };
  if (!companyId || !taskId) {
    return NextResponse.json({ error: "companyId and taskId required" }, { status: 400 });
  }

  // IDOR guard: caller must own the company AND the task must belong to it.
  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const tasks = await getScheduledTasksByCompany(companyId);
  if (!tasks.find((t) => t.id === taskId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await import("@/lib/db");
  await db.updateTaskStatus(taskId, "failed", { error_message: "Cancelled by user" });

  return NextResponse.json({ cancelled: true });
}
