/**
 * Agent SDK — typed contract that all platform agent templates implement.
 *
 * This is the surface eng-review locked at decision 2A-B (SDK + shared helpers,
 * not thin contract, not heavyweight framework). 31 CA-pack agents and all
 * future vertical-pack agents fork from this contract. The reference example
 * lives in src/lib/packs/ca-firm/a4-bank-recon.ts.
 *
 * Design doc:
 *   ~/.gstack/projects/matterhornso-theautonomousorg/abhinavramesh-main-design-20260501-162924.md
 *
 * Helper interfaces (Vault, WhatsApp approval, lessons, escalation) live in
 * src/lib/agent-sdk-helpers.ts. Their implementations land in workstream PRs
 * (W4 WhatsApp router, W5 Vault module).
 */

import { z, type ZodTypeAny, type infer as ZodInfer } from "zod";

// ─── Trigger spec ──────────────────────────────────────────────────────────
// Every agent fires from one of these triggers. Schedule = cron. Webhook =
// inbound HTTP. Whatsapp_intent = the multi-tenant WhatsApp router routed to
// us based on a sender intent classification (e.g. "submit_bill"). Manual =
// SPOC or partner explicitly invokes from the admin portal.

export type TriggerSpec =
  | { kind: "schedule"; cron: string; timezone?: string }
  | { kind: "webhook"; pathSuffix: string; signatureHeader?: string }
  | { kind: "whatsapp_intent"; intent: string }
  | { kind: "manual" };

// ─── Tool binding ──────────────────────────────────────────────────────────
// Tools the agent can use during a run. Each tool has a stable name (used in
// LLM tool-use messages), a Zod schema for inputs, and a handler. The SDK
// validates inputs against the schema before invoking the handler.

export interface ToolBinding<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: AgentRunContext) => Promise<TOutput>;
}

// ─── Config schema ─────────────────────────────────────────────────────────
// Per-firm config slots that the SPOC sets at deployment time and can update
// in the admin portal. Examples: escalation thresholds, role mappings,
// integration endpoints, SLA windows. Validated against Zod when written.

export interface ConfigSchema {
  schema: ZodTypeAny;
  defaults?: Record<string, unknown>;
}

// ─── Budget ────────────────────────────────────────────────────────────────
// Hard caps on a single agent run. Enforced by the runtime, not the agent
// itself. Exceeding any limit → onError fires with a BudgetExceededError.

export interface AgentBudget {
  /** Total LLM tokens (input + output) across all model calls in one run. */
  maxTokens: number;
  /** Total tool invocations in one run. */
  maxToolCalls: number;
  /** Wall-clock timeout for the entire run, in milliseconds. */
  timeoutMs: number;
}

// ─── Observability ─────────────────────────────────────────────────────────

export interface ObservabilitySpec {
  /**
   * minimal: log only run start/end + error if any. Use for high-volume,
   * non-sensitive agents (e.g. T1 timesheet capture).
   *
   * full: log every model call, tool call, and lifecycle hook into the
   * Langfuse trace. Use for debugging and compliance-sensitive agents
   * (e.g. Q4 quality dashboard, I1 independence monitoring).
   */
  traceLevel: "minimal" | "full";
}

// ─── Run context ───────────────────────────────────────────────────────────
// Threaded through every hook and tool handler. Provides access to:
//   - The active tenant (companyId, userId)
//   - The agent's run id (for tracing + lessons table)
//   - The active model (so agents can observe which provider they're on)
//   - Per-firm config resolved from defaults + overrides
//   - Helper handles (Vault, WhatsApp, lessons, escalation) — see
//     agent-sdk-helpers.ts

export interface AgentRunContext<TConfig = Record<string, unknown>> {
  agentId: string;
  runId: string;
  companyId: string;
  userId: string;
  /** Resolved config for this firm: defaults merged with per-firm overrides. */
  config: TConfig;
  /** Active model identifier (e.g. "claude-opus-4-7"). */
  model: string;
  /**
   * Helpers; populated by the runtime before beforeRun fires. Each helper
   * is a thin facade around its respective module.
   */
  helpers: import("./agent-sdk-helpers").AgentHelpers;
  /** Logger that writes into the active Langfuse trace. */
  log: (level: "debug" | "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) => void;
  /** Track tokens used so far; useful for early-exit if budget is tight. */
  tokensUsed: () => number;
  /** Track tool calls used so far. */
  toolCallsUsed: () => number;
}

// ─── Lifecycle hooks ───────────────────────────────────────────────────────

export interface AgentHooks<TInput, TOutput> {
  /**
   * Fires before the LLM is invoked. Use for:
   *   - Reading lessons from prior runs (helpers.lessons.readRecent)
   *   - Loading firm context from Vault (helpers.vault.query)
   *   - Pre-flight validation that input is processable
   * Throwing here aborts the run; onError fires.
   */
  beforeRun?: (ctx: AgentRunContext, input: TInput) => Promise<void>;

  /**
   * Fires after a successful run. Use for:
   *   - Writing a lesson reflection (helpers.lessons.write)
   *   - Pushing output to downstream system (Tally, Zoho, SharePoint)
   *   - Triggering inter-agent handoff (helpers.escalation.handoff)
   * Throwing here marks the run as failed even though the LLM produced output.
   */
  afterRun?: (ctx: AgentRunContext, input: TInput, output: TOutput) => Promise<void>;

  /**
   * Fires on any thrown error from beforeRun, the LLM, tools, or afterRun.
   * Use for:
   *   - SPOC alert on transient failures (helpers.escalation.alertSpoc)
   *   - Tally-agent-offline graceful degradation
   *   - Recording failure context for the lessons table
   * Should NOT re-throw unless you want the runtime to mark the run as
   * unrecoverable. Returning normally allows the runtime to retry.
   */
  onError?: (ctx: AgentRunContext, error: unknown, phase: "before" | "run" | "after") => Promise<void>;
}

// ─── Prompt template ───────────────────────────────────────────────────────
// Render the system + user prompts from input + ctx. Kept as a function so
// agents can inject Vault context, lessons, firm-specific tone, etc.

export interface PromptTemplate<TInput = unknown> {
  system: string | ((input: TInput, ctx: AgentRunContext) => string | Promise<string>);
  user: string | ((input: TInput, ctx: AgentRunContext) => string | Promise<string>);
}

// ─── The contract ──────────────────────────────────────────────────────────

export interface AgentDefinition<
  TInputSchema extends ZodTypeAny = ZodTypeAny,
  TOutputSchema extends ZodTypeAny = ZodTypeAny,
  TConfigSchema extends ZodTypeAny = ZodTypeAny
> {
  /** Stable identifier. Convention: `<cluster>_<name>`, e.g. "finance_a4_bank_recon". */
  id: string;
  /** Cluster (vertical pack section): "finance", "independence", etc. */
  cluster: string;
  /** Human-readable name shown in admin portal. */
  name: string;
  /** One-line description shown in admin portal. */
  description: string;

  trigger: TriggerSpec;
  input: TInputSchema;
  output: TOutputSchema;
  prompt: PromptTemplate<ZodInfer<TInputSchema>>;
  // Existential generics: each ToolBinding may have its own input/output types.
  // The runtime validates per-tool inputs against each tool's own schema, so
  // the array element type is intentionally widened to `unknown` boundaries.
  // Inside handler() bodies, the schema-narrowed type is preserved by the
  // ToolBinding<TInput, TOutput> generics.
  tools?: Array<ToolBinding<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  config: ConfigSchema & { schema: TConfigSchema };
  hooks?: AgentHooks<ZodInfer<TInputSchema>, ZodInfer<TOutputSchema>>;
  budget: AgentBudget;
  observability: ObservabilitySpec;
}

// ─── defineAgent factory ───────────────────────────────────────────────────
// Validates the definition shape and returns it typed. Catches structural
// mistakes (missing trigger, invalid budget, etc.) at module-load time
// instead of at first run.

const definitionShape = z.object({
  id: z.string().min(1).regex(/^[a-z0-9_]+$/, "id must be lowercase letters, digits, underscore"),
  cluster: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  budget: z.object({
    maxTokens: z.number().int().positive(),
    maxToolCalls: z.number().int().nonnegative(),
    timeoutMs: z.number().int().positive(),
  }),
  observability: z.object({
    traceLevel: z.enum(["minimal", "full"]),
  }),
});

export function defineAgent<
  TInputSchema extends ZodTypeAny,
  TOutputSchema extends ZodTypeAny,
  TConfigSchema extends ZodTypeAny
>(
  def: AgentDefinition<TInputSchema, TOutputSchema, TConfigSchema>
): AgentDefinition<TInputSchema, TOutputSchema, TConfigSchema> {
  const result = definitionShape.safeParse({
    id: def.id,
    cluster: def.cluster,
    name: def.name,
    description: def.description,
    budget: def.budget,
    observability: def.observability,
  });
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`defineAgent(${def.id ?? "<no-id>"}): invalid definition — ${issues}`);
  }
  if (!def.trigger || !def.input || !def.output || !def.prompt || !def.config) {
    throw new Error(`defineAgent(${def.id}): trigger/input/output/prompt/config are all required`);
  }
  return def;
}

// ─── Errors ────────────────────────────────────────────────────────────────

export class BudgetExceededError extends Error {
  constructor(
    public readonly limit: keyof AgentBudget,
    public readonly used: number,
    public readonly cap: number
  ) {
    super(`Agent budget exceeded: ${limit} = ${used} > ${cap}`);
    this.name = "BudgetExceededError";
  }
}

export class InputValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(`Agent input validation failed: ${issues.map((i) => i.message).join("; ")}`);
    this.name = "InputValidationError";
  }
}

export class OutputValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(`Agent output validation failed: ${issues.map((i) => i.message).join("; ")}`);
    this.name = "OutputValidationError";
  }
}
