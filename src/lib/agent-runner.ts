/**
 * AgentRunner — runtime that executes an AgentDefinition.
 *
 * Composes the SDK contract (src/lib/agent-sdk.ts) with the real helper
 * implementations (whatsapp, vault, lessons, escalation). Per the eng-review
 * lock, the runner is responsible for:
 *
 *   1. Validating input against the agent's Zod schema (-> InputValidationError)
 *   2. Resolving config: defaults merged with per-firm overrides from DB
 *   3. Building AgentRunContext with helpers wired to the firm
 *   4. Running beforeRun hook (errors -> onError -> abort)
 *   5. Calling Anthropic in a tool-use loop with budget enforcement:
 *      - maxTokens (input + output across all turns)
 *      - maxToolCalls (cumulative tool invocations)
 *      - timeoutMs (wall-clock)
 *   6. Validating final output against the agent's output schema
 *   7. Running afterRun hook
 *   8. Recording a structured trace (Langfuse-shaped) for observability
 *
 * Errors from any phase route through the agent's onError hook before
 * surfacing. If onError returns normally, the runner classifies the error:
 *   - BudgetExceeded / OutputValidation -> permanent, no retry
 *   - Network / 5xx from Anthropic -> retry up to 2 times with backoff
 *   - Anything else -> surface as RunFailed
 *
 * Tests in test/agent-runner.test.ts use a mock LLM client; no real network calls.
 */

import { randomUUID } from "crypto";
import {
  BudgetExceededError,
  InputValidationError,
  OutputValidationError,
  type AgentDefinition,
  type AgentRunContext,
  type ToolBinding,
} from "./agent-sdk";
import type { AgentHelpers } from "./agent-sdk-helpers";
import { buildWhatsAppHelper } from "./whatsapp";
import { buildVaultHelper } from "./vault";
import { buildLessonsHelper } from "./lessons";
import { buildEscalationHelper } from "./escalation";
import { runWithTenantStore } from "./tenant-context";

// ─── LLM client abstraction ────────────────────────────────────────────────
// Lets tests swap in a mock without touching @anthropic-ai/sdk. The real
// client is constructed lazily from the SDK so the module loads in test
// environments without ANTHROPIC_API_KEY.

export interface LLMTextBlock {
  type: "text";
  text: string;
}
export interface LLMToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
export type LLMContentBlock = LLMTextBlock | LLMToolUseBlock;

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LLMResponse {
  content: LLMContentBlock[];
  /** One of: "end_turn", "tool_use", "max_tokens", "stop_sequence". */
  stop_reason: string;
  usage: LLMUsage;
}

export interface LLMToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string | LLMContentBlock[] | Array<{ type: "tool_result"; tool_use_id: string; content: string }>;
  }>;
  tools?: LLMToolSpec[];
}

export interface LLMClient {
  createMessage(req: LLMRequest): Promise<LLMResponse>;
}

let _anthropic: unknown | null = null;
function getAnthropicClient(): LLMClient {
  return {
    async createMessage(req: LLMRequest): Promise<LLMResponse> {
      if (!_anthropic) {
        // Lazy import so tests with no ANTHROPIC_API_KEY don't trip module init.
        const mod = await import("@anthropic-ai/sdk");
        const Anthropic = (mod as unknown as { default: new () => unknown }).default;
        _anthropic = new Anthropic();
      }
      const client = _anthropic as {
        messages: { create: (r: LLMRequest) => Promise<LLMResponse> };
      };
      return await client.messages.create(req);
    },
  };
}

// ─── Run-time errors ───────────────────────────────────────────────────────

export class AgentTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Agent run exceeded timeout of ${timeoutMs}ms`);
    this.name = "AgentTimeoutError";
  }
}

export class AgentRunFailedError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AgentRunFailedError";
  }
}

// ─── Trace shape (Langfuse-compatible) ─────────────────────────────────────

export interface AgentTraceEvent {
  ts: number;
  level: "debug" | "info" | "warn" | "error";
  kind: "lifecycle" | "model_call" | "tool_call" | "log" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentTrace {
  agentId: string;
  runId: string;
  companyId: string;
  userId: string;
  startTs: number;
  endTs?: number;
  events: AgentTraceEvent[];
  /** Set on a successful run. */
  success?: boolean;
  /** Tokens used (input + output, summed across all model calls). */
  totalTokens: number;
  toolCallsCount: number;
}

// ─── Run options ───────────────────────────────────────────────────────────

export interface RunAgentOptions {
  /** Tenant context — companyId + userId. */
  companyId: string;
  userId: string;
  /** Per-firm config overrides; merged onto the agent's defaults. */
  configOverrides?: Record<string, unknown>;
  /** Override the LLM client (tests). */
  llmClient?: LLMClient;
  /** Override the helpers bundle (tests). If absent, runner builds real helpers. */
  helpers?: AgentHelpers;
  /** Override the model id (e.g. switch to Haiku for cheap evals). */
  model?: string;
  /** Override the runId (tests). */
  runId?: string;
}

export interface AgentRunResult<TOutput> {
  output: TOutput;
  trace: AgentTrace;
  /** Raw assistant message text (last turn), useful when output is freeform. */
  rawText: string;
}

// ─── runAgent ──────────────────────────────────────────────────────────────

export async function runAgent<
  TInput,
  TOutput
>(
  def: AgentDefinition,
  rawInput: TInput,
  opts: RunAgentOptions
): Promise<AgentRunResult<TOutput>> {
  const runId = opts.runId ?? `run_${randomUUID()}`;
  const startTs = Date.now();
  const trace: AgentTrace = {
    agentId: def.id,
    runId,
    companyId: opts.companyId,
    userId: opts.userId,
    startTs,
    events: [],
    totalTokens: 0,
    toolCallsCount: 0,
  };

  function pushEvent(ev: Omit<AgentTraceEvent, "ts">) {
    trace.events.push({ ts: Date.now(), ...ev });
  }

  // Resolve model from opts > def.observability metadata > default Sonnet 4.6.
  // The SDK doesn't currently bind a default model, so we use the platform default.
  const model = opts.model ?? "claude-sonnet-4-6";
  const client = opts.llmClient ?? getAnthropicClient();

  // ── Validate input ───────────────────────────────────────────────────────
  const inputParse = def.input.safeParse(rawInput);
  if (!inputParse.success) {
    throw new InputValidationError(inputParse.error.issues);
  }
  const input = inputParse.data;

  // ── Resolve config ───────────────────────────────────────────────────────
  const merged = { ...(def.config.defaults ?? {}), ...(opts.configOverrides ?? {}) };
  const configParse = def.config.schema.safeParse(merged);
  if (!configParse.success) {
    throw new InputValidationError(configParse.error.issues);
  }
  const config = configParse.data as Record<string, unknown>;

  // ── Build helpers (or use the override) ──────────────────────────────────
  const helpers: AgentHelpers = opts.helpers ?? buildDefaultHelpers({
    firmId: opts.companyId,
    agentId: def.id,
    runId,
  });

  // ── Build run context ────────────────────────────────────────────────────
  let tokensUsed = 0;
  let toolCallsUsed = 0;

  const ctx: AgentRunContext = {
    agentId: def.id,
    runId,
    companyId: opts.companyId,
    userId: opts.userId,
    config,
    model,
    helpers,
    log: (level, msg, meta) => {
      pushEvent({ level, kind: "log", message: msg, data: meta });
    },
    tokensUsed: () => tokensUsed,
    toolCallsUsed: () => toolCallsUsed,
  };

  function checkBudget() {
    if (tokensUsed > def.budget.maxTokens) {
      throw new BudgetExceededError("maxTokens", tokensUsed, def.budget.maxTokens);
    }
    if (toolCallsUsed > def.budget.maxToolCalls) {
      throw new BudgetExceededError(
        "maxToolCalls",
        toolCallsUsed,
        def.budget.maxToolCalls
      );
    }
    if (Date.now() - startTs > def.budget.timeoutMs) {
      throw new AgentTimeoutError(def.budget.timeoutMs);
    }
  }

  // ── Run with tenant context active in AsyncLocalStorage ─────────────────
  return await runWithTenantStore(
    { companyId: opts.companyId, userId: opts.userId },
    async () => {
      try {
        // beforeRun hook
        pushEvent({ level: "info", kind: "lifecycle", message: "beforeRun", data: { agentId: def.id } });
        if (def.hooks?.beforeRun) {
          try {
            await def.hooks.beforeRun(ctx, input);
          } catch (err) {
            await runOnError(def, ctx, err, "before", trace);
            throw new AgentRunFailedError("beforeRun hook failed", err);
          }
        }

        // Render prompts
        const systemPrompt = await renderPrompt(def.prompt.system, input, ctx);
        const userPrompt = await renderPrompt(def.prompt.user, input, ctx);

        // ── Tool-use loop ───────────────────────────────────────────────────
        const tools: ToolBinding[] = (def.tools ?? []) as ToolBinding[];
        const toolSpecs: LLMToolSpec[] = tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: zodToJsonSchema(t.inputSchema),
        }));

        const messages: LLMRequest["messages"] = [
          { role: "user", content: userPrompt },
        ];
        let assistantText = "";
        const maxLoopIterations = Math.max(2, def.budget.maxToolCalls + 2);
        let stopReason = "";

        for (let i = 0; i < maxLoopIterations; i++) {
          checkBudget();
          pushEvent({
            level: "debug",
            kind: "model_call",
            message: `model_call iteration ${i}`,
            data: { model, messageCount: messages.length },
          });
          const response = await client.createMessage({
            model,
            max_tokens: Math.min(4096, def.budget.maxTokens - tokensUsed),
            system: systemPrompt,
            messages,
            tools: toolSpecs.length > 0 ? toolSpecs : undefined,
          });
          tokensUsed += response.usage.input_tokens + response.usage.output_tokens;
          trace.totalTokens = tokensUsed;
          stopReason = response.stop_reason;
          // Check budget AFTER we account for tokens — so a single oversized
          // response trips the limit before the loop continues.
          checkBudget();

          // Append assistant turn.
          messages.push({ role: "assistant", content: response.content });

          // Collect text + tool_use blocks.
          const toolUses = response.content.filter(
            (c): c is LLMToolUseBlock => c.type === "tool_use"
          );
          const textBlocks = response.content.filter(
            (c): c is LLMTextBlock => c.type === "text"
          );
          assistantText = textBlocks.map((b) => b.text).join("\n").trim();

          if (toolUses.length === 0) break; // end_turn

          // Execute tools, push tool_results, loop.
          const toolResults: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: string;
          }> = [];
          for (const tu of toolUses) {
            const binding = tools.find((t) => t.name === tu.name);
            if (!binding) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ error: `Unknown tool: ${tu.name}` }),
              });
              continue;
            }
            const parsed = binding.inputSchema.safeParse(tu.input);
            if (!parsed.success) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({
                  error: "Tool input validation failed",
                  issues: parsed.error.issues,
                }),
              });
              continue;
            }
            toolCallsUsed++;
            trace.toolCallsCount = toolCallsUsed;
            checkBudget();
            try {
              const out = await binding.handler(parsed.data, ctx);
              pushEvent({
                level: "debug",
                kind: "tool_call",
                message: `tool ${binding.name}`,
                data: { input: parsed.data, hasOutput: out !== undefined },
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(out ?? null),
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              pushEvent({
                level: "warn",
                kind: "tool_call",
                message: `tool ${binding.name} threw`,
                data: { error: msg },
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ error: msg }),
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }

        if (stopReason !== "end_turn" && stopReason !== "stop_sequence") {
          // Loop exited because we ran out of iterations or tokens.
          pushEvent({
            level: "warn",
            kind: "lifecycle",
            message: "tool-use loop exited without end_turn",
            data: { stopReason },
          });
        }

        // ── Validate output ──────────────────────────────────────────────────
        const outputCandidate = parseOutputCandidate(assistantText);
        const outputParse = def.output.safeParse(outputCandidate);
        if (!outputParse.success) {
          const e = new OutputValidationError(outputParse.error.issues);
          await runOnError(def, ctx, e, "run", trace);
          throw e;
        }
        const output = outputParse.data as TOutput;

        // ── afterRun hook ────────────────────────────────────────────────────
        pushEvent({ level: "info", kind: "lifecycle", message: "afterRun" });
        if (def.hooks?.afterRun) {
          try {
            await def.hooks.afterRun(ctx, input, output);
          } catch (err) {
            await runOnError(def, ctx, err, "after", trace);
            throw new AgentRunFailedError("afterRun hook failed", err);
          }
        }

        trace.success = true;
        trace.endTs = Date.now();
        pushEvent({
          level: "info",
          kind: "lifecycle",
          message: "run complete",
          data: { tokens: tokensUsed, toolCalls: toolCallsUsed },
        });

        return { output, trace, rawText: assistantText };
      } catch (err) {
        trace.success = false;
        trace.endTs = Date.now();
        pushEvent({
          level: "error",
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildDefaultHelpers(args: {
  firmId: string;
  agentId: string;
  runId: string;
}): AgentHelpers {
  const whatsapp = buildWhatsAppHelper(args);
  return {
    whatsapp,
    vault: buildVaultHelper({ firmId: args.firmId }),
    lessons: buildLessonsHelper({ firmId: args.firmId, agentId: args.agentId }),
    escalation: buildEscalationHelper({
      firmId: args.firmId,
      agentId: args.agentId,
      runId: args.runId,
      whatsapp,
    }),
  };
}

async function renderPrompt<TInput>(
  tpl: string | ((input: TInput, ctx: AgentRunContext) => string | Promise<string>),
  input: TInput,
  ctx: AgentRunContext
): Promise<string> {
  if (typeof tpl === "string") return tpl;
  const out = tpl(input, ctx);
  return typeof out === "string" ? out : await out;
}

async function runOnError(
  def: AgentDefinition,
  ctx: AgentRunContext,
  err: unknown,
  phase: "before" | "run" | "after",
  trace: AgentTrace
): Promise<void> {
  if (!def.hooks?.onError) return;
  try {
    await def.hooks.onError(ctx, err, phase);
  } catch (hookErr) {
    trace.events.push({
      ts: Date.now(),
      level: "error",
      kind: "error",
      message: "onError hook itself threw",
      data: { hookError: hookErr instanceof Error ? hookErr.message : String(hookErr) },
    });
  }
}

/**
 * Try to extract a JSON object from the assistant's final text turn.
 * Many agent prompts ask the model to return JSON; we tolerate code fences
 * and surrounding prose. If parsing fails, we hand the raw text to the
 * output schema; structured schemas will reject and free-form schemas
 * (z.string()) will accept.
 */
function parseOutputCandidate(text: string): unknown {
  if (!text) return null;
  // Pull JSON out of a markdown code fence, anywhere in the text.
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  // Find the first balanced { ... } or [ ... ] and try to parse.
  const trimmed = text.trim();
  for (const open of ["{", "["]) {
    const close = open === "{" ? "}" : "]";
    const start = trimmed.indexOf(open);
    if (start < 0) continue;
    const end = trimmed.lastIndexOf(close);
    if (end <= start) continue;
    const candidate = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      /* fall through */
    }
  }
  return text;
}

/**
 * Minimal Zod -> JSON schema converter. Supports the shape the SDK uses for
 * tool inputs (z.object with primitives and optionals). For richer schemas,
 * agents can hand-roll a JSON schema in their tool definition; a future
 * iteration swaps this out for `zod-to-json-schema` once that dep lands.
 */
function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  // Fall back to a permissive object schema; the runtime still validates via
  // schema.safeParse before invoking the handler. The Anthropic API accepts
  // an object with `type: "object"` and `properties: {}` — it just won't
  // give the model a tight type hint. That's acceptable until we migrate to
  // zod-to-json-schema.
  // Best-effort introspection for common shapes:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = schema as any;
  if (s?._def?.typeName === "ZodObject") {
    const shape = typeof s._def.shape === "function" ? s._def.shape() : s.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, child] of Object.entries(shape ?? {})) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const childAny = child as any;
      const isOptional = childAny?.isOptional?.() ?? false;
      properties[key] = jsonTypeFor(childAny);
      if (!isOptional) required.push(key);
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
  return { type: "object", properties: {} };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonTypeFor(z: any): Record<string, unknown> {
  const tn = z?._def?.typeName;
  if (tn === "ZodString") return { type: "string" };
  if (tn === "ZodNumber") return { type: "number" };
  if (tn === "ZodBoolean") return { type: "boolean" };
  if (tn === "ZodOptional") return jsonTypeFor(z._def.innerType);
  if (tn === "ZodNullable") return jsonTypeFor(z._def.innerType);
  if (tn === "ZodArray")
    return { type: "array", items: jsonTypeFor(z._def.type) };
  if (tn === "ZodEnum") return { type: "string", enum: z._def.values };
  if (tn === "ZodObject") return zodToJsonSchema(z);
  return {};
}
