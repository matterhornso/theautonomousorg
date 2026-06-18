import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createWorkflow,
  getWorkflowsByCompany,
  getWorkflow,
  getCompany,
  deleteWorkflow,
  updateWorkflow,
} from "@/lib/db";
import { inTenant } from "@/lib/with-tenant-route";

/** Load a workflow and confirm the caller owns its company, else return an error response. */
async function requireWorkflowOwnership(userId: string, workflowId: string | null) {
  if (!workflowId) {
    return { ok: false as const, response: NextResponse.json({ error: "Missing workflowId" }, { status: 400 }) };
  }
  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const company = await getCompany(workflow.company_id);
  if (!company || company.user_id !== userId) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const company = await getCompany(companyId);
  if (!company || company.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Example of the RLS-ready pattern: companyId is known + ownership verified,
  // so run the tenant query inside the GUC-scoped transaction (inTenant). After
  // the app_user cutover this query is also enforced by RLS, not just the check
  // above. See src/lib/with-tenant-route.ts.
  const workflows = await inTenant(companyId, userId, () =>
    getWorkflowsByCompany(companyId)
  );
  return NextResponse.json({ workflows });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { companyId, name, description, triggerAgentRole, triggerEvent, steps } = body;

  if (!companyId || !name || !triggerAgentRole || !triggerEvent || !steps || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const company = await getCompany(companyId);
  if (!company || company.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workflow = await createWorkflow({
    company_id: companyId,
    name,
    description: description || undefined,
    trigger_agent_role: triggerAgentRole,
    trigger_event: triggerEvent,
    steps_json: JSON.stringify(steps),
  });

  return NextResponse.json({ workflow }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workflowId, name, description, steps, isActive } = body;

  const guard = await requireWorkflowOwnership(userId, workflowId);
  if (!guard.ok) return guard.response;

  await updateWorkflow(workflowId, {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(steps !== undefined && { steps_json: JSON.stringify(steps) }),
    ...(isActive !== undefined && { is_active: isActive ? 1 : 0 }),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflowId = request.nextUrl.searchParams.get("workflowId");

  const guard = await requireWorkflowOwnership(userId, workflowId);
  if (!guard.ok) return guard.response;

  await deleteWorkflow(workflowId!);
  return NextResponse.json({ ok: true });
}
