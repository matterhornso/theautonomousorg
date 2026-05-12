import "server-only";

import { resolveTenant, type ResolvedTenant } from "./resolve-tenant";
import * as mock from "../_data/mock";
import type {
  AdminNotification,
  PendingApproval,
  VaultDoc,
  RoleAgent,
  AgentRun,
  Integration,
} from "../_data/mock";

/**
 * Server-side data layer for /admin pages.
 *
 * Strategy: query Postgres when DATABASE_URL is set; fall back to checked-in
 * mock fixtures when it isn't, so the UI keeps rendering with realistic
 * placeholder data during local dev / before the first agent run is recorded.
 *
 * Each loader is a pure async function that takes a ResolvedTenant. The page
 * components call resolveTenant() once via the layout, then thread the firm
 * id into specific loaders.
 *
 * As real run data starts flowing (post WhatsApp + AgentRunner wiring), the
 * mock fallbacks will simply stop being used — no UI changes required.
 */

const HAS_DB = !!process.env.DATABASE_URL;

export interface AdminBootstrap {
  tenant: ResolvedTenant;
  firm: {
    id: string;
    name: string;
    initials: string;
    industry: string | null;
    stage: string | null;
    url: string;
    customers: number;
    spocName: string;
    spocPhone: string;
    provisioningState: "created" | "schema_applied" | "kms_provisioned" | "langfuse_provisioned" | "vault_initialized" | "ready";
  };
  roleAgents: RoleAgent[];
  recentRuns: AgentRun[];
  pendingApprovals: PendingApproval[];
  notifications: AdminNotification[];
  vaultDocs: VaultDoc[];
  integrations: Integration[];
}

export async function loadAdminBootstrap(): Promise<AdminBootstrap> {
  const tenant = await resolveTenant();

  const [pendingApprovals, notifications, vaultDocs] = await Promise.all([
    loadPendingApprovals(tenant.firm.id),
    loadNotifications(tenant.firm.id),
    loadVaultDocs(tenant.firm.id),
  ]);

  return {
    tenant,
    firm: {
      id: tenant.firm.id,
      name: tenant.firm.name,
      initials: tenant.firm.initials,
      industry: tenant.firm.industry,
      stage: tenant.firm.stage,
      url: tenant.firm.url,
      customers: mock.firm.customers,
      spocName:
        [tenant.user.firstName, tenant.user.lastName].filter(Boolean).join(" ") ||
        tenant.user.email ||
        "SPOC",
      spocPhone: mock.firm.spocPhone,
      provisioningState: "ready",
    },
    roleAgents: mock.roleAgents,
    recentRuns: mock.recentRuns,
    pendingApprovals,
    notifications,
    vaultDocs,
    integrations: mock.integrations,
  };
}

// ─── Individual surface loaders ──────────────────────────────────────────

export async function loadPendingApprovals(
  companyId: string
): Promise<PendingApproval[]> {
  if (!HAS_DB) return mock.pendingApprovals;
  try {
    const sql = await getSql();
    const rows = await sql<
      Array<{
        card_id: string;
        agent_id: string;
        run_id: string;
        action: string;
        payload: Record<string, unknown> | null;
        expiry: Date;
        resolved_at: Date;
      }>
    >`
      SELECT card_id, agent_id, run_id, action, payload, expiry, resolved_at
      FROM approval_callbacks
      WHERE firm_id = ${companyId}
        AND resolved_at IS NULL
        AND expiry > NOW()
      ORDER BY expiry ASC
      LIMIT 12
    `;
    if (rows.length === 0) return mock.pendingApprovals;
    return rows.map((r) => {
      const out: PendingApproval = {
        cardId: r.card_id,
        agentId: r.agent_id,
        escalatedFromRole: (r.payload?.role as string) ?? "Operations",
        runId: r.run_id,
        title: (r.payload?.title as string) ?? "Awaiting your decision",
        body: (r.payload?.body as string) ?? "",
        toName: (r.payload?.toName as string) ?? "Founder",
        to: (r.payload?.toPhone as string) ?? "+91 ••••• •••••",
        sentAt: new Date(r.resolved_at),
        expiry: Math.floor(new Date(r.expiry).getTime() / 1000),
      };
      const amount = r.payload?.amountInr;
      if (typeof amount === "number") out.amountInr = amount;
      return out;
    });
  } catch {
    return mock.pendingApprovals;
  }
}

export async function loadNotifications(
  companyId: string
): Promise<AdminNotification[]> {
  if (!HAS_DB) return mock.notifications;
  try {
    const sql = await getSql();
    const rows = await sql<
      Array<{
        id: string;
        agent_id: string | null;
        run_id: string | null;
        severity: "P1" | "P2" | "P3" | "INFO";
        kind: string;
        subject: string;
        detail: string;
        role_hint: string | null;
        acknowledged_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT id, agent_id, run_id, severity, kind, subject, detail,
             role_hint, acknowledged_at, created_at
      FROM admin_notifications
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    if (rows.length === 0) return mock.notifications;
    return rows.map((r) => {
      const out: AdminNotification = {
        id: r.id,
        fromRole: r.role_hint ?? "system",
        agentId: r.agent_id ?? "agent_ceo",
        runId: r.run_id ?? null,
        severity: r.severity,
        kind: r.kind as AdminNotification["kind"],
        subject: r.subject,
        detail: r.detail,
        acknowledgedAt: r.acknowledged_at,
        createdAt: r.created_at,
      };
      if (r.role_hint) out.roleHint = r.role_hint;
      return out;
    });
  } catch {
    return mock.notifications;
  }
}

export async function loadVaultDocs(companyId: string): Promise<VaultDoc[]> {
  if (!HAS_DB) return mock.vaultDocs;
  try {
    const sql = await getSql();
    const rows = await sql<
      Array<{
        id: string;
        title: string;
        doc_type: string | null;
        chunk_count: number;
        pages: number | null;
        excerpt: string | null;
        ingested_by: string | null;
        entities_json: string | null;
        created_at: Date;
      }>
    >`
      SELECT d.id, d.title, d.doc_type, d.pages, d.excerpt, d.ingested_by,
             d.entities_json, d.created_at,
             COALESCE((SELECT COUNT(*)::int FROM vault_chunks c WHERE c.document_id = d.id), 0) AS chunk_count
      FROM vault_documents d
      WHERE d.company_id = ${companyId}
      ORDER BY d.created_at DESC
      LIMIT 30
    `;
    if (rows.length === 0) return mock.vaultDocs;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      docType: r.doc_type ?? "user_input",
      chunkCount: r.chunk_count,
      pages: r.pages,
      excerpt: r.excerpt ?? "",
      ingestedBy: r.ingested_by ?? "user",
      entities: r.entities_json
        ? (JSON.parse(r.entities_json) as VaultDoc["entities"])
        : [],
      createdAt: r.created_at,
    }));
  } catch {
    return mock.vaultDocs;
  }
}

// ─── Lazy postgres handle ────────────────────────────────────────────────

let _sql: unknown = null;

async function getSql() {
  if (!_sql) {
    const mod = await import("@/lib/db-postgres");
    // db-postgres exports a `sql` template tag we can reuse. If it doesn't,
    // throwing will trigger the catch above and pages fall back to mock.
    const candidate = (mod as { sql?: unknown }).sql;
    if (typeof candidate !== "function") {
      throw new Error("db-postgres does not expose sql tag");
    }
    _sql = candidate;
  }
  return _sql as <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}
