/**
 * A4 — Bank Reconciliation Agent (CA-firm vertical pack reference).
 *
 * Per design doc: "Daily automated match of bank statement to ledger.
 * Flags unmatched items only — finance sees exceptions, not the full run."
 *
 * This is the SDK reference example. The other 30 CA-pack agents fork
 * from this shape. Eng review locked decisions referenced here:
 *   - Section 4 4A-A: per-tenant pgvector index (Vault scoped per firm)
 *   - Section 1 1B-B: Tally read-only by default (this agent only reads)
 *   - Section 3 critical gap #5: regression test for bank-recon happy path
 *
 * Status: contract-only. The real implementation depends on:
 *   - Tally on-prem agent shipping (W3) so we can read bank statement +
 *     ledger from Tally
 *   - Vault module shipping (W5) so we can pull firm-specific reconciliation
 *     conventions
 *   - WhatsApp BSP router (W4) for the SPOC alert flow
 *
 * Until those land, this file declares the agent definition + tools so
 * the SDK shape is exercised end-to-end. A live test fixture in
 * test/agent-sdk.test.ts validates the definition compiles and registers.
 */

import { z } from "zod";
import { defineAgent, type ToolBinding } from "../../agent-sdk";

// ─── Input / output schemas ────────────────────────────────────────────────

const inputSchema = z.object({
  /** ISO date for which we're reconciling, e.g. "2026-05-01". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Optional: scope to a specific bank account ledger id. */
  bankAccountLedgerId: z.string().optional(),
});

const outputSchema = z.object({
  matchedCount: z.number().int().nonnegative(),
  unmatchedItems: z.array(
    z.object({
      ledgerEntryId: z.string().optional(),
      bankStatementRowId: z.string().optional(),
      amount: z.number(),
      narration: z.string(),
      reason: z.enum([
        "no_ledger_match",
        "no_bank_match",
        "amount_mismatch",
        "date_mismatch_within_window",
        "duplicate_candidate",
      ]),
      suggestedAction: z.string(),
    })
  ),
  reconRunDurationMs: z.number().int().nonnegative(),
});

// ─── Config schema ─────────────────────────────────────────────────────────

const configSchema = z.object({
  /** Window in days for date-mismatch tolerance. JAA default: 7. */
  dateMismatchWindowDays: z.number().int().min(1).max(30).default(7),
  /** Auto-match threshold: amount + counterparty fuzzy-match score (0-1). */
  fuzzyMatchThreshold: z.number().min(0).max(1).default(0.85),
  /** Phone number to receive the daily exception summary. */
  reconAlertWhatsAppPhone: z.string().regex(/^\+\d{8,15}$/),
});

// ─── Tools ─────────────────────────────────────────────────────────────────

const fetchBankStatementTool: ToolBinding<
  { date: string; ledgerId?: string },
  { rows: Array<{ id: string; amount: number; narration: string; date: string }> }
> = {
  name: "fetch_bank_statement",
  description: "Pull bank statement rows for the given date from Tally via the on-prem agent.",
  inputSchema: z.object({
    date: z.string(),
    ledgerId: z.string().optional(),
  }),
  handler: async (_input, _ctx) => {
    // Real implementation: call helpers.tally.fetchBankStatement(...)
    // For now: stub that throws so the SDK validates structure but doesn't
    // pretend to be functional.
    throw new Error("fetch_bank_statement: requires Tally on-prem agent (W3)");
  },
};

const fetchLedgerEntriesTool: ToolBinding<
  { date: string; ledgerId?: string; windowDays: number },
  { rows: Array<{ id: string; amount: number; narration: string; date: string }> }
> = {
  name: "fetch_ledger_entries",
  description:
    "Pull ledger entries from Tally for the date plus the date-mismatch window. Used to find delayed-posting matches.",
  inputSchema: z.object({
    date: z.string(),
    ledgerId: z.string().optional(),
    windowDays: z.number().int(),
  }),
  handler: async (_input, _ctx) => {
    throw new Error("fetch_ledger_entries: requires Tally on-prem agent (W3)");
  },
};

// ─── Agent definition ──────────────────────────────────────────────────────

export const a4BankReconAgent = defineAgent({
  id: "finance_a4_bank_recon",
  cluster: "finance",
  name: "Bank Reconciliation Agent",
  description:
    "Daily match of bank statement to ledger. Flags exceptions only; auto-matches the rest.",

  trigger: {
    kind: "schedule",
    cron: "0 7 * * *", // 7 AM daily
    timezone: "Asia/Kolkata",
  },

  input: inputSchema,
  output: outputSchema,
  config: { schema: configSchema },

  prompt: {
    system: (input, ctx) => `You are a bank reconciliation agent for ${ctx.companyId}. Your job is to compare the day's bank statement against the firm's ledger and surface ONLY the exceptions a human needs to look at. Auto-matched items are reported as a count, not enumerated. Tone: terse, accountant-appropriate. No filler, no compliments. Only escalate items where confidence is below the configured fuzzy-match threshold or where the date mismatch exceeds the configured window. The recon date is ${input.date}.`,
    user: (input) =>
      `Reconcile bank statement vs ledger for ${input.date}${input.bankAccountLedgerId ? ` (ledger ${input.bankAccountLedgerId})` : ""}. Use fetch_bank_statement and fetch_ledger_entries to pull data. Match by amount + counterparty + date (within window). Return structured output matching the output schema.`,
  },

  tools: [fetchBankStatementTool, fetchLedgerEntriesTool],

  hooks: {
    beforeRun: async (ctx, input) => {
      // Pre-flight: load last 5 lessons so the LLM sees recent corrections
      // (e.g. "user rejected match because vendor name had extra whitespace").
      const lessons = await ctx.helpers.lessons.readRecent({ limit: 5 });
      ctx.log("debug", "loaded prior lessons", { count: lessons.length, date: input.date });
    },
    afterRun: async (ctx, input, output) => {
      // Send WhatsApp alert listing exceptions only. No spam if zero exceptions.
      if (output.unmatchedItems.length > 0) {
        const cfg = ctx.config as z.infer<typeof configSchema>;
        await ctx.helpers.whatsapp.sendNotification({
          to: cfg.reconAlertWhatsAppPhone,
          body: `[Bank recon ${input.date}] ${output.matchedCount} matched, ${output.unmatchedItems.length} need review. Open admin portal to resolve.`,
        });
      }
      // Always write a lesson so cross-run learning compounds.
      await ctx.helpers.lessons.write({
        agentId: ctx.agentId,
        runId: ctx.runId,
        taskDescription: `Reconcile bank vs ledger for ${input.date}`,
        outputAccepted: "unknown",
        selfCritique: `Matched=${output.matchedCount}, exceptions=${output.unmatchedItems.length}, duration=${output.reconRunDurationMs}ms`,
      });
    },
    onError: async (ctx, error, phase) => {
      // Tally on-prem agent offline is a known failure mode; alert SPOC, don't crash.
      const msg = error instanceof Error ? error.message : String(error);
      const isTallyOffline = msg.includes("Tally") || msg.includes("on-prem") || msg.includes("ECONNREFUSED");
      if (isTallyOffline) {
        await ctx.helpers.escalation.alertSpoc({
          severity: "P2",
          subject: "Bank recon agent: Tally on-prem agent unreachable",
          detail: `Phase: ${phase}. Last error: ${msg}. Reads will return stale data with timestamp until reconnect.`,
        });
        return; // graceful degradation, don't re-throw
      }
      // Other errors propagate — runtime decides retry vs fail.
      throw error;
    },
  },

  budget: {
    maxTokens: 50_000, // typical run: ~5-10K; budget for outliers
    maxToolCalls: 6, // fetch_bank + fetch_ledger × occasional reruns
    timeoutMs: 5 * 60 * 1000, // 5 minutes hard cap
  },

  observability: {
    traceLevel: "full", // recon is finance-critical; full Langfuse trace
  },
});
