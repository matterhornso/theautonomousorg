/**
 * EscalationHelper implementation. Composes WhatsApp notifications with
 * persistent admin_notifications rows so SPOC + partners see escalations
 * regardless of WhatsApp delivery state.
 *
 * Three surfaces:
 *   - handoff: writes an inter_agent_messages row so the target agent's
 *     scheduler picks up the work. No WhatsApp by default.
 *   - alertSpoc: WhatsApp template + admin_notifications(kind='spoc_alert').
 *     Used for transient infra failures (Tally offline, KMS issues).
 *   - escalateToHuman: WhatsApp template + admin_notifications(kind='human_escalation').
 *     Used when the agent decides a human in a specific role needs to look.
 *
 * The SPOC phone number is resolved from the firm's `companies.spoc_phone`
 * column (or env override for tests).
 *
 * Tests: test/escalation.test.ts mocks postgres + the WhatsAppHelper.
 */

import { randomUUID } from "crypto";
import type { EscalationHelper, WhatsAppHelper } from "./agent-sdk-helpers";
import { buildWhatsAppHelper } from "./whatsapp";

export interface EscalationHelperContext {
  /** Active firm. */
  firmId: string;
  /** Active agent. Used as source for inter_agent_messages handoffs + audit. */
  agentId: string;
  /** Active run. Cross-referenced with Langfuse + lessons. */
  runId: string;
  /** WhatsAppHelper bound to this run. Composed from buildWhatsAppHelper(). */
  whatsapp: WhatsAppHelper;
  /**
   * Resolves the SPOC phone for a firm. Default looks up companies.spoc_phone.
   * Tests pass a mock to avoid the DB.
   */
  resolveSpocPhone?: (firmId: string) => Promise<string | null>;
}

async function defaultResolveSpocPhone(firmId: string): Promise<string | null> {
  const { sql } = await import("./db-postgres");
  if (!sql) return null;
  const rows = (await sql`
    SELECT spoc_phone FROM companies WHERE id = ${firmId} LIMIT 1
  `) as Array<{ spoc_phone: string | null }>;
  return rows[0]?.spoc_phone ?? null;
}

export function buildEscalationHelper(ctx: EscalationHelperContext): EscalationHelper {
  const resolveSpocPhone = ctx.resolveSpocPhone ?? defaultResolveSpocPhone;

  return {
    async handoff({ toAgentId, reason, context }) {
      const { sql } = await import("./db-postgres");
      if (!sql) {
        console.warn("[escalation] handoff skipped: DATABASE_URL missing", { toAgentId, reason });
        return;
      }
      const id = `iam_${randomUUID()}`;
      const request = JSON.stringify({ reason, context: context ?? {}, fromRunId: ctx.runId });
      await sql`
        INSERT INTO inter_agent_messages (id, source_agent_id, target_agent_id, request)
        VALUES (${id}, ${ctx.agentId}, ${toAgentId}, ${request})
      `;
    },

    async alertSpoc({ severity, subject, detail }) {
      // Persist first; WhatsApp is best-effort.
      await persistNotification({
        firmId: ctx.firmId,
        agentId: ctx.agentId,
        runId: ctx.runId,
        severity,
        kind: "spoc_alert",
        subject,
        detail,
      });
      const phone = await resolveSpocPhone(ctx.firmId);
      if (phone) {
        try {
          await ctx.whatsapp.sendNotification({
            to: phone,
            body: `[${severity}] ${subject}\n${detail}`,
          });
        } catch (err) {
          // Don't fail the agent run because the BSP is down.
          console.warn("[escalation] alertSpoc WhatsApp send failed:", err);
        }
      } else {
        console.warn("[escalation] alertSpoc: no spoc_phone for firm", ctx.firmId);
      }
    },

    async escalateToHuman({ roleHint, subject, detail }) {
      await persistNotification({
        firmId: ctx.firmId,
        agentId: ctx.agentId,
        runId: ctx.runId,
        severity: "P2",
        kind: "human_escalation",
        subject,
        detail,
        roleHint,
      });
      // For now, the SPOC fans out to the right human. Future: per-role phone
      // resolution from team_members.role + team_members.whatsapp_phone.
      const phone = await resolveSpocPhone(ctx.firmId);
      if (phone) {
        try {
          await ctx.whatsapp.sendNotification({
            to: phone,
            body: `[Escalate to ${roleHint}] ${subject}\n${detail}`,
          });
        } catch (err) {
          console.warn("[escalation] escalateToHuman WhatsApp send failed:", err);
        }
      }
    },
  };
}

interface PersistArgs {
  firmId: string;
  /** Null when the notification is composed outside an agent run (e.g. webhook keyword). */
  agentId: string | null;
  /** Null when there is no associated agent run. */
  runId: string | null;
  severity: "P1" | "P2" | "P3" | "INFO";
  kind: string;
  subject: string;
  detail: string;
  roleHint?: string;
}

// ─── Webhook-context escalation ────────────────────────────────────────────
// Used by bare webhook handlers (e.g. the Telegram timesheet bot's HELP
// keyword) that don't have an agent run to attach to. Persists an
// admin_notifications row and best-effort pings the SPOC via WhatsApp.

export interface NotifyHelpRequestOptions {
  /** Tenant whose admin should see the notification. */
  companyId: string;
  /** Short headline shown in the admin notifications inbox. */
  subject: string;
  /** Multi-line context — who asked, what period, what channel, raw message. */
  detail: string;
  /** Optional routing hint (e.g. "partner", "admin"). Stored on the row. */
  roleHint?: string;
  /** Injectable for tests. Defaults to companies.spoc_phone lookup. */
  resolveSpocPhone?: (firmId: string) => Promise<string | null>;
  /** Injectable for tests. Defaults to env-configured Gupshup helper. */
  whatsapp?: WhatsAppHelper;
}

export async function notifyHelpRequest(
  opts: NotifyHelpRequestOptions
): Promise<{ persisted: boolean; whatsappSent: boolean }> {
  const resolveSpocPhone = opts.resolveSpocPhone ?? defaultResolveSpocPhone;
  let persisted = false;
  let whatsappSent = false;

  try {
    persisted = await persistNotification({
      firmId: opts.companyId,
      agentId: null,
      runId: null,
      severity: "P2",
      kind: "help_request",
      subject: opts.subject,
      detail: opts.detail,
      roleHint: opts.roleHint,
    });
  } catch (err) {
    console.warn("[escalation] notifyHelpRequest: persist failed:", err);
  }

  try {
    const phone = await resolveSpocPhone(opts.companyId);
    if (phone) {
      const wa =
        opts.whatsapp ??
        buildWhatsAppHelper({
          firmId: opts.companyId,
          agentId: "system",
          runId: `notif_${randomUUID()}`,
        });
      await wa.sendNotification({
        to: phone,
        body: `[Help requested] ${opts.subject}\n${opts.detail}`,
      });
      whatsappSent = true;
    }
  } catch (err) {
    console.warn("[escalation] notifyHelpRequest: WhatsApp send failed:", err);
  }

  return { persisted, whatsappSent };
}

async function persistNotification(args: PersistArgs): Promise<boolean> {
  const { sql } = await import("./db-postgres");
  if (!sql) {
    console.warn("[escalation] notification not persisted; DATABASE_URL missing", args);
    return false;
  }
  const id = `note_${randomUUID()}`;
  await sql`
    INSERT INTO admin_notifications (
      id, company_id, agent_id, run_id, severity, kind, subject, detail, role_hint
    ) VALUES (
      ${id},
      ${args.firmId},
      ${args.agentId},
      ${args.runId},
      ${args.severity},
      ${args.kind},
      ${args.subject},
      ${args.detail},
      ${args.roleHint ?? null}
    )
  `;
  return true;
}
