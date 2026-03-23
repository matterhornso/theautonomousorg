import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import {
  getCompaniesByUser,
  getWebhooksByCompany,
  createWebhook,
  getWebhook,
  deactivateWebhook,
  getAgent,
} from "@/lib/db";

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

  const webhooks = getWebhooksByCompany(companyId);
  return NextResponse.json(
    webhooks.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      agent_id: w.agent_id,
      task_type: w.task_type,
      task_title_template: w.task_title_template,
      is_active: !!w.is_active,
      last_triggered_at: w.last_triggered_at,
      trigger_count: w.trigger_count,
      webhookUrl: `https://theautonomous.org/api/webhooks/${w.id}`,
      created_at: w.created_at,
    }))
  );
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId: string;
    agentId: string;
    name: string;
    description?: string;
    taskType?: string;
    taskTitleTemplate?: string;
  };

  if (!body.companyId || !body.agentId || !body.name) {
    return NextResponse.json(
      { error: "companyId, agentId, and name are required" },
      { status: 400 }
    );
  }

  const companies = getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === body.companyId)) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const agent = getAgent(body.agentId);
  if (!agent || agent.company_id !== body.companyId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Generate a secret for signature validation
  const secret = randomBytes(32).toString("hex");

  const webhook = createWebhook({
    company_id: body.companyId,
    agent_id: body.agentId,
    name: body.name,
    description: body.description,
    secret,
    task_type: body.taskType,
    task_title_template: body.taskTitleTemplate,
  });

  return NextResponse.json({
    webhookId: webhook.id,
    webhookUrl: `https://theautonomous.org/api/webhooks/${webhook.id}`,
    secret,
    message: "Save this secret — it won't be shown again.",
  });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { webhookId, companyId } = (await request.json()) as {
    webhookId: string;
    companyId: string;
  };

  if (!webhookId || !companyId) {
    return NextResponse.json(
      { error: "webhookId and companyId are required" },
      { status: 400 }
    );
  }

  const companies = getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const webhook = getWebhook(webhookId);
  if (!webhook || webhook.company_id !== companyId) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  deactivateWebhook(webhookId);
  return NextResponse.json({ deactivated: true });
}
