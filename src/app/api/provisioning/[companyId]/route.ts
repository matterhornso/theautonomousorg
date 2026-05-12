import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompany, getAgentsByCompany } from "@/lib/db";

const HAS_DB = !!process.env.DATABASE_URL;

const ORDER = [
  "created",
  "schema_applied",
  "kms_provisioned",
  "langfuse_provisioned",
  "vault_initialized",
  "ready",
] as const;

type ProvisioningState = (typeof ORDER)[number] | "failed";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { companyId } = await params;
  const company = await getCompany(companyId);
  if (!company) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (company.user_id && company.user_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const agents = await getAgentsByCompany(companyId);

  // Postgres has the provisioning_state column from migration 004; SQLite
  // doesn't, and untouched rows on Postgres can be NULL on legacy data. Treat
  // any unknown state as "ready" so the UI doesn't hang.
  let state: ProvisioningState = "ready";
  let error: string | null = null;

  if (HAS_DB) {
    const raw = (company as unknown as { provisioning_state?: string | null; provisioning_error?: string | null }).provisioning_state;
    error = (company as unknown as { provisioning_error?: string | null }).provisioning_error ?? null;
    if (raw && (ORDER as readonly string[]).includes(raw)) {
      state = raw as ProvisioningState;
    } else if (raw === "failed") {
      state = "failed";
    }
  }

  return NextResponse.json({
    companyId,
    name: company.name,
    state,
    error,
    progressIndex: ORDER.indexOf(state as (typeof ORDER)[number]),
    progressTotal: ORDER.length,
    agents: agents.map((a) => ({ id: a.id, role: a.role, status: a.status })),
  });
}
