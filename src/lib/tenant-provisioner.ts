/**
 * Tenant provisioner state machine (W9).
 *
 * Idempotent end-to-end provisioning of a new firm:
 *   1. created          → companies row exists
 *   2. schema_applied   → RLS migrations applied (no-op in v1; assumed shared schema)
 *   3. kms_provisioned  → per-firm KMS CMK alias set (W2 placeholder for v1)
 *   4. langfuse_provisioned → Langfuse project id recorded (placeholder for v1)
 *   5. vault_initialized → Vault index ready (no-op in v1; shared pgvector index)
 *   6. ready
 *
 * Each step is idempotent: re-running advances from whatever state the firm
 * is currently in, never repeats completed steps. State persists in the
 * `companies` table so the provisioner survives process restarts.
 *
 * Outside-voice 3 risk mitigation: cap self-serve onboarding at "waitlist"
 * mode until the provisioner has been validated at ≥5 tenants. The
 * `selfServeBlocked` export reads an env flag the admin portal uses.
 */

import type { Sql } from "postgres";

export type ProvisioningState =
  | "created"
  | "schema_applied"
  | "kms_provisioned"
  | "langfuse_provisioned"
  | "vault_initialized"
  | "ready"
  | "failed";

const STATE_ORDER: ProvisioningState[] = [
  "created",
  "schema_applied",
  "kms_provisioned",
  "langfuse_provisioned",
  "vault_initialized",
  "ready",
];

// ─── External step adapters (DI for tests) ─────────────────────────────────

export interface ProvisionerAdapters {
  /** Apply schema bootstrap for the new tenant. v1 is a no-op; v2 creates per-firm partitions. */
  applySchema?: (firmId: string) => Promise<void>;
  /** Provision a KMS CMK alias for the firm. Returns the alias string. v1 returns a fake until W2 lands. */
  provisionKms?: (firmId: string) => Promise<string>;
  /** Provision a Langfuse project. Returns the project id. */
  provisionLangfuse?: (firmId: string) => Promise<string>;
  /** Initialize the Vault index for the firm. v1: no-op. v2: create partition + HNSW index. */
  initializeVault?: (firmId: string) => Promise<void>;
}

const defaultAdapters: Required<ProvisionerAdapters> = {
  applySchema: async () => {
    // v1: shared schema. RLS handles tenant isolation.
  },
  provisionKms: async (firmId) => {
    // v1 placeholder: KMS module lands in W2. Use a deterministic alias so the
    // companies row reflects the future-real mapping. The alias gets replaced
    // by the real CMK once W2 ships.
    return `alias/firm/${firmId}`;
  },
  provisionLangfuse: async (firmId) => {
    // v1 placeholder: Langfuse provisioning is manual. Use the firmId so traces
    // can be filtered by project_id without further plumbing.
    return `lf_${firmId}`;
  },
  initializeVault: async () => {
    // v1: shared vault_documents/vault_chunks tables, RLS-isolated.
  },
};

// ─── Provisioning ──────────────────────────────────────────────────────────

export interface ProvisionFirmInput {
  firmId: string;
  /** Used when the row doesn't exist yet (createOrAdvance flow). */
  name?: string;
  url?: string;
  spocPhone?: string;
  /** Owner Clerk user id; null for back-office-created firms. */
  userId?: string;
}

export interface ProvisionResult {
  firmId: string;
  state: ProvisioningState;
  kmsKeyAlias: string | null;
  langfuseProjectId: string | null;
  /** Number of state transitions applied in this call. 0 == already ready. */
  steps: number;
  /** Set if state landed at 'failed'. */
  error?: string;
}

export class TenantProvisioner {
  constructor(private adapters: Required<ProvisionerAdapters>) {}

  static withDefaults(adapters?: ProvisionerAdapters): TenantProvisioner {
    return new TenantProvisioner({ ...defaultAdapters, ...(adapters ?? {}) });
  }

  async provision(
    input: ProvisionFirmInput,
    sql?: Sql
  ): Promise<ProvisionResult> {
    const db = sql ?? (await this.getSql());
    if (!db) throw new Error("tenant-provisioner: DATABASE_URL not configured");

    let row = await this.upsertCreated(db, input);
    let steps = 0;

    while (row.provisioning_state !== "ready") {
      const next = this.nextState(row.provisioning_state as ProvisioningState);
      try {
        const updates = await this.executeStep(next, input.firmId);
        await this.persistTransition(db, input.firmId, next, updates);
        row = await this.fetchRow(db, input.firmId);
        steps++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.persistTransition(db, input.firmId, "failed", {
          provisioning_error: msg,
        });
        return {
          firmId: input.firmId,
          state: "failed",
          kmsKeyAlias: row.kms_key_alias,
          langfuseProjectId: row.langfuse_project_id,
          steps,
          error: msg,
        };
      }
    }
    return {
      firmId: input.firmId,
      state: row.provisioning_state as ProvisioningState,
      kmsKeyAlias: row.kms_key_alias,
      langfuseProjectId: row.langfuse_project_id,
      steps,
    };
  }

  private async getSql(): Promise<Sql | null> {
    const { sql } = await import("./db-postgres");
    return sql;
  }

  private nextState(current: ProvisioningState): ProvisioningState {
    if (current === "failed") {
      // Restart from where we know things were good. Conservative: schema_applied.
      return "schema_applied";
    }
    const i = STATE_ORDER.indexOf(current);
    if (i < 0 || i === STATE_ORDER.length - 1) return "ready";
    return STATE_ORDER[i + 1];
  }

  private async executeStep(
    next: ProvisioningState,
    firmId: string
  ): Promise<Record<string, string>> {
    switch (next) {
      case "schema_applied":
        await this.adapters.applySchema(firmId);
        return {};
      case "kms_provisioned": {
        const alias = await this.adapters.provisionKms(firmId);
        return { kms_key_alias: alias };
      }
      case "langfuse_provisioned": {
        const projectId = await this.adapters.provisionLangfuse(firmId);
        return { langfuse_project_id: projectId };
      }
      case "vault_initialized":
        await this.adapters.initializeVault(firmId);
        return {};
      case "ready":
      case "created":
      case "failed":
        return {};
    }
  }

  private async upsertCreated(sql: Sql, input: ProvisionFirmInput): Promise<CompanyRow> {
    const existing = (await sql`
      SELECT id, user_id, name, url, spoc_phone, kms_key_alias, langfuse_project_id,
             provisioning_state, provisioning_error
      FROM companies WHERE id = ${input.firmId} LIMIT 1
    `) as CompanyRow[];
    if (existing[0]) {
      // If ad-hoc fields drifted (e.g. a SPOC phone was added later), refresh them.
      if (input.spocPhone && existing[0].spoc_phone !== input.spocPhone) {
        await sql`UPDATE companies SET spoc_phone = ${input.spocPhone} WHERE id = ${input.firmId}`;
      }
      // Ensure provisioning_state is at least 'created' on legacy rows.
      if (!existing[0].provisioning_state) {
        await sql`
          UPDATE companies SET provisioning_state = 'created' WHERE id = ${input.firmId}
        `;
      }
      return await this.fetchRow(sql, input.firmId);
    }
    if (!input.name || !input.url) {
      throw new Error(
        `tenant-provisioner: companies.${input.firmId} doesn't exist; name + url required to create`
      );
    }
    await sql`
      INSERT INTO companies (id, user_id, name, url, spoc_phone, provisioning_state)
      VALUES (
        ${input.firmId},
        ${input.userId ?? null},
        ${input.name},
        ${input.url},
        ${input.spocPhone ?? null},
        'created'
      )
    `;
    return await this.fetchRow(sql, input.firmId);
  }

  private async persistTransition(
    sql: Sql,
    firmId: string,
    state: ProvisioningState,
    extras: Record<string, string>
  ): Promise<void> {
    // Build dynamic SET clause. Only the columns we know about are settable;
    // anything else is filtered. We do this with discrete cases to avoid
    // dynamic SQL identifier injection.
    const setKms = "kms_key_alias" in extras ? extras.kms_key_alias : null;
    const setLangfuse = "langfuse_project_id" in extras ? extras.langfuse_project_id : null;
    const setError = "provisioning_error" in extras ? extras.provisioning_error : null;
    await sql`
      UPDATE companies
      SET provisioning_state = ${state},
          provisioning_error = ${state === "failed" ? setError : null},
          kms_key_alias = COALESCE(${setKms}, kms_key_alias),
          langfuse_project_id = COALESCE(${setLangfuse}, langfuse_project_id),
          provisioned_at = CASE WHEN ${state} = 'ready' THEN NOW() ELSE provisioned_at END
      WHERE id = ${firmId}
    `;
  }

  private async fetchRow(sql: Sql, firmId: string): Promise<CompanyRow> {
    const rows = (await sql`
      SELECT id, user_id, name, url, spoc_phone, kms_key_alias, langfuse_project_id,
             provisioning_state, provisioning_error
      FROM companies WHERE id = ${firmId} LIMIT 1
    `) as CompanyRow[];
    if (!rows[0]) throw new Error(`tenant-provisioner: row ${firmId} not found post-write`);
    return rows[0];
  }
}

interface CompanyRow {
  id: string;
  user_id: string | null;
  name: string;
  url: string;
  spoc_phone: string | null;
  kms_key_alias: string | null;
  langfuse_project_id: string | null;
  provisioning_state: string | null;
  provisioning_error: string | null;
}

// ─── Self-serve gate ───────────────────────────────────────────────────────

/**
 * Reads env to decide whether self-serve onboarding is allowed.
 * Default is `false` until the provisioner has been validated at ≥5 tenants
 * (per outside-voice risk 3 mitigation). Admin portal flips this once ready.
 */
export function selfServeBlocked(): boolean {
  return process.env.PROVISIONER_SELF_SERVE !== "enabled";
}
