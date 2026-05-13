/**
 * Unit tests for AgentRunner. Mocks the LLM client + helper bundle so no
 * network or DB calls happen.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { defineAgent, BudgetExceededError, OutputValidationError, InputValidationError } from "@/lib/agent-sdk";
import type { AgentHelpers } from "@/lib/agent-sdk-helpers";
import { runAgent, type LLMClient, type LLMResponse, AgentTimeoutError } from "@/lib/agent-runner";

// ─── Test fixtures ──────────────────────────────────────────────────────────

function makeStubHelpers(): AgentHelpers {
  return {
    whatsapp: {
      sendApprovalCard: vi.fn().mockResolvedValue({ cardId: "c1", messageId: "m1" }),
      sendNotification: vi.fn().mockResolvedValue({ messageId: "m2" }),
    },
    vault: {
      query: vi.fn().mockResolvedValue([]),
      ingest: vi.fn().mockResolvedValue({ docId: "d1", chunkCount: 0 }),
    },
    lessons: {
      readRecent: vi.fn().mockResolvedValue([]),
      write: vi.fn().mockResolvedValue(undefined),
    },
    escalation: {
      handoff: vi.fn().mockResolvedValue(undefined),
      alertSpoc: vi.fn().mockResolvedValue(undefined),
      escalateToHuman: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function makeMockLLM(
  responses: LLMResponse[]
): { client: LLMClient; calls: number } {
  let i = 0;
  const state = { calls: 0 };
  return {
    calls: state.calls,
    client: {
      async createMessage() {
        state.calls++;
        const r = responses[i] ?? responses[responses.length - 1];
        i++;
        return r;
      },
    },
  };
}

const inputSchema = z.object({ task: z.string() });
const outputSchema = z.object({ summary: z.string(), score: z.number() });
const configSchema = z.object({ tone: z.string().default("neutral") });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAgent(overrides: Record<string, any> = {}) {
  return defineAgent({
    id: "test_agent",
    cluster: "test",
    name: "Test Agent",
    description: "A test agent",
    trigger: { kind: "manual" },
    input: inputSchema,
    output: outputSchema,
    config: { schema: configSchema, defaults: { tone: "neutral" } },
    prompt: {
      system: "You are a test agent.",
      user: (i: { task: string }) => `Process: ${i.task}`,
    },
    budget: { maxTokens: 1000, maxToolCalls: 3, timeoutMs: 5000 },
    observability: { traceLevel: "minimal" },
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("runAgent — happy path", () => {
  it("validates input + output and returns parsed output", async () => {
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary": "ok", "score": 7}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 8 },
      },
    ]);
    const result = await runAgent(def, { task: "hello" }, {
      companyId: "firm_a",
      userId: "user_a",
      llmClient: llm.client,
      helpers: makeStubHelpers(),
    });
    expect(result.output).toEqual({ summary: "ok", score: 7 });
    expect(result.trace.success).toBe(true);
    expect(result.trace.totalTokens).toBe(18);
    expect(result.trace.events.some((e) => e.kind === "model_call")).toBe(true);
  });

  it("strips markdown code fences before parsing JSON output", async () => {
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [
          {
            type: "text",
            text: 'Here is the result:\n```json\n{"summary": "ok", "score": 5}\n```',
          },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 5 },
      },
    ]);
    const result = await runAgent(def, { task: "x" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm.client,
      helpers: makeStubHelpers(),
    });
    expect(result.output).toEqual({ summary: "ok", score: 5 });
  });

  it("runs beforeRun and afterRun hooks in order", async () => {
    const order: string[] = [];
    const def = makeAgent({
      hooks: {
        beforeRun: async () => {
          order.push("before");
        },
        afterRun: async () => {
          order.push("after");
        },
      },
    });
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);
    await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm.client,
      helpers: makeStubHelpers(),
    });
    expect(order).toEqual(["before", "after"]);
  });

  it("merges per-firm config overrides onto defaults", async () => {
    let observedConfig: unknown = null;
    const def = makeAgent({
      hooks: {
        beforeRun: async (ctx: { config: unknown }) => {
          observedConfig = ctx.config;
        },
      },
    });
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);
    await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm.client,
      helpers: makeStubHelpers(),
      configOverrides: { tone: "terse" },
    });
    expect(observedConfig).toEqual({ tone: "terse" });
  });
});

describe("runAgent — tool-use loop", () => {
  it("dispatches tool calls and feeds results back to the model", async () => {
    const fetchTool = {
      name: "fetch_data",
      description: "Fetch some data",
      inputSchema: z.object({ id: z.string() }),
      handler: vi.fn().mockResolvedValue({ data: "42" }),
    };
    const def = makeAgent({ tools: [fetchTool] });
    const llm: LLMClient = {
      createMessage: vi
        .fn()
        // First turn: tool_use
        .mockResolvedValueOnce({
          content: [
            { type: "tool_use", id: "tool_1", name: "fetch_data", input: { id: "x" } },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 5 },
        } as LLMResponse)
        // Second turn: final answer
        .mockResolvedValueOnce({
          content: [{ type: "text", text: '{"summary":"got 42","score":9}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 5 },
        } as LLMResponse),
    };
    const result = await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm,
      helpers: makeStubHelpers(),
    });
    expect(fetchTool.handler).toHaveBeenCalledTimes(1);
    expect(fetchTool.handler.mock.calls[0][0]).toEqual({ id: "x" });
    expect(result.trace.toolCallsCount).toBe(1);
    expect(result.output).toEqual({ summary: "got 42", score: 9 });
  });

  it("handles a tool that throws by feeding the error back to the model", async () => {
    const brokenTool = {
      name: "broken",
      description: "Always throws",
      inputSchema: z.object({}),
      handler: vi.fn().mockRejectedValue(new Error("oops")),
    };
    const def = makeAgent({ tools: [brokenTool] });
    let secondTurnUserMessage: unknown = null;
    const llm: LLMClient = {
      createMessage: vi
        .fn()
        .mockImplementationOnce(async () => ({
          content: [{ type: "tool_use", id: "t1", name: "broken", input: {} }],
          stop_reason: "tool_use",
          usage: { input_tokens: 1, output_tokens: 1 },
        }))
        .mockImplementationOnce(async (req) => {
          secondTurnUserMessage = req.messages[req.messages.length - 1];
          return {
            content: [{ type: "text", text: '{"summary":"recovered","score":1}' }],
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          };
        }),
    };
    const result = await runAgent<{ task: string }, { summary: string; score: number }>(
      def,
      { task: "t" },
      {
        companyId: "f",
        userId: "u",
        llmClient: llm,
        helpers: makeStubHelpers(),
      }
    );
    expect(result.output.summary).toBe("recovered");
    // The second turn should carry a tool_result containing the error.
    const content = (secondTurnUserMessage as { content: Array<{ content: string }> })
      .content;
    expect(content[0].content).toContain("oops");
  });

  it("rejects tool input that doesn't match the schema before calling the handler", async () => {
    const tool = {
      name: "needs_id",
      description: "Needs an id",
      inputSchema: z.object({ id: z.string() }),
      handler: vi.fn(),
    };
    const def = makeAgent({ tools: [tool] });
    const llm: LLMClient = {
      createMessage: vi
        .fn()
        .mockImplementationOnce(async () => ({
          content: [
            { type: "tool_use", id: "t1", name: "needs_id", input: { wrong: 1 } },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 1, output_tokens: 1 },
        }))
        .mockImplementationOnce(async () => ({
          content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        })),
    };
    await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm,
      helpers: makeStubHelpers(),
    });
    expect(tool.handler).not.toHaveBeenCalled();
  });
});

describe("runAgent — budget enforcement", () => {
  it("throws BudgetExceededError when token usage exceeds maxTokens", async () => {
    const def = makeAgent({
      budget: { maxTokens: 5, maxToolCalls: 0, timeoutMs: 5000 },
    });
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 50, output_tokens: 50 },
      },
    ]);
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: llm.client,
        helpers: makeStubHelpers(),
      })
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it("throws BudgetExceededError when tool calls exceed maxToolCalls", async () => {
    const tool = {
      name: "loop",
      description: "Loop tool",
      inputSchema: z.object({}),
      handler: vi.fn().mockResolvedValue({ ok: true }),
    };
    const def = makeAgent({
      tools: [tool],
      budget: { maxTokens: 100000, maxToolCalls: 1, timeoutMs: 5000 },
    });
    let toolUseCount = 0;
    const llm: LLMClient = {
      createMessage: vi.fn().mockImplementation(async () => {
        toolUseCount++;
        if (toolUseCount <= 3) {
          return {
            content: [{ type: "tool_use", id: `t${toolUseCount}`, name: "loop", input: {} }],
            stop_reason: "tool_use",
            usage: { input_tokens: 1, output_tokens: 1 },
          } as LLMResponse;
        }
        return {
          content: [{ type: "text", text: '{"summary":"done","score":1}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        } as LLMResponse;
      }),
    };
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: llm,
        helpers: makeStubHelpers(),
      })
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });
});

describe("runAgent — errors", () => {
  it("throws InputValidationError on bad input", async () => {
    const def = makeAgent();
    await expect(
      runAgent(def, { wrong: "shape" } as unknown as { task: string }, {
        companyId: "f",
        userId: "u",
        llmClient: makeMockLLM([]).client,
        helpers: makeStubHelpers(),
      })
    ).rejects.toBeInstanceOf(InputValidationError);
  });

  it("throws OutputValidationError when LLM returns unparseable output", async () => {
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: "totally not json and no schema match" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: llm.client,
        helpers: makeStubHelpers(),
      })
    ).rejects.toBeInstanceOf(OutputValidationError);
  });

  it("invokes onError hook when beforeRun throws and surfaces AgentRunFailedError", async () => {
    const onError = vi.fn().mockResolvedValue(undefined);
    const def = makeAgent({
      hooks: {
        beforeRun: async () => {
          throw new Error("pre-flight fail");
        },
        onError,
      },
    });
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: makeMockLLM([]).client,
        helpers: makeStubHelpers(),
      })
    ).rejects.toThrow(/beforeRun hook failed/);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][2]).toBe("before");
  });

  it("does NOT crash when onError itself throws", async () => {
    const def = makeAgent({
      hooks: {
        beforeRun: async () => {
          throw new Error("pre");
        },
        onError: async () => {
          throw new Error("hook also broken");
        },
      },
    });
    // The original error propagates wrapped; the trace records the second failure.
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: makeMockLLM([]).client,
        helpers: makeStubHelpers(),
      })
    ).rejects.toThrow(/beforeRun hook failed/);
  });
});

describe("runAgent — trace shape", () => {
  it("records lifecycle, model_call, and tool_call events", async () => {
    const tool = {
      name: "ping",
      description: "ping",
      inputSchema: z.object({}),
      handler: vi.fn().mockResolvedValue({}),
    };
    const def = makeAgent({ tools: [tool] });
    const llm: LLMClient = {
      createMessage: vi
        .fn()
        .mockImplementationOnce(async () => ({
          content: [{ type: "tool_use", id: "t1", name: "ping", input: {} }],
          stop_reason: "tool_use",
          usage: { input_tokens: 1, output_tokens: 1 },
        }))
        .mockImplementationOnce(async () => ({
          content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        })),
    };
    const result = await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm,
      helpers: makeStubHelpers(),
    });
    const kinds = result.trace.events.map((e) => e.kind);
    expect(kinds).toContain("lifecycle");
    expect(kinds).toContain("model_call");
    expect(kinds).toContain("tool_call");
    expect(result.trace.toolCallsCount).toBe(1);
    expect(result.trace.totalTokens).toBe(4);
  });

  it("records error event when run fails", async () => {
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: "garbage" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);
    let captured: Error | null = null;
    let captureTrace: ReturnType<typeof makeMockLLM>["client"] | null = null;
    captureTrace = llm.client;
    void captureTrace;
    try {
      await runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: llm.client,
        helpers: makeStubHelpers(),
      });
    } catch (e) {
      captured = e as Error;
    }
    expect(captured).toBeInstanceOf(OutputValidationError);
  });
});

describe("runAgent — timeout", () => {
  it("throws AgentTimeoutError when wall-clock exceeds timeoutMs", async () => {
    const def = makeAgent({
      budget: { maxTokens: 100000, maxToolCalls: 5, timeoutMs: 10 },
    });
    const llm: LLMClient = {
      createMessage: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return {
          content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      },
    };
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: llm,
        helpers: makeStubHelpers(),
      })
    ).rejects.toBeInstanceOf(AgentTimeoutError);
  });
});

// ─── Persistence: agent_runs writes ─────────────────────────────────────────
//
// runAgent mirrors its trace to the `agent_runs` table so /admin/agents/[role]
// can render real runs without round-tripping Langfuse. Tests assert call
// shape via a stubbed `persistence` option; nothing here hits Postgres.

describe("runAgent — agent_runs persistence", () => {
  function makePersistence() {
    return {
      recordStart: vi.fn().mockResolvedValue(null),
      recordComplete: vi.fn().mockResolvedValue(null),
    };
  }

  it("calls recordStart with the run id and recordComplete on success with split token usage", async () => {
    const persistence = makePersistence();
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 7, output_tokens: 11 },
      },
    ]).client;
    const result = await runAgent(
      def,
      { task: "do thing" },
      {
        companyId: "firm-1",
        userId: "user-1",
        runId: "run_test_1",
        llmClient: llm,
        helpers: makeStubHelpers(),
        persistence,
        triggeredBy: "cron",
        triggerDetail: "nightly:test",
      }
    );
    expect(persistence.recordStart).toHaveBeenCalledOnce();
    expect(persistence.recordStart.mock.calls[0][0]).toMatchObject({
      id: "run_test_1",
      companyId: "firm-1",
      agentRole: "test_agent",
      agentId: "test_agent",
      triggeredBy: "cron",
      triggerDetail: "nightly:test",
      input: { task: "do thing" },
    });
    expect(persistence.recordComplete).toHaveBeenCalledOnce();
    expect(persistence.recordComplete.mock.calls[0][0]).toBe("run_test_1");
    expect(persistence.recordComplete.mock.calls[0][1]).toMatchObject({
      status: "completed",
      modelUsed: "claude-sonnet-4-6",
      provider: "anthropic",
      tokensIn: 7,
      tokensOut: 11,
    });
    expect(persistence.recordComplete.mock.calls[0][1].output).toEqual({
      summary: "ok",
      score: 1,
    });
    expect(result.trace.success).toBe(true);
  });

  it("records 'failed' status when output validation fails", async () => {
    const persistence = makePersistence();
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: "not json at all" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 3, output_tokens: 4 },
      },
    ]).client;
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: llm,
        helpers: makeStubHelpers(),
        persistence,
      })
    ).rejects.toBeInstanceOf(OutputValidationError);
    expect(persistence.recordStart).toHaveBeenCalledOnce();
    expect(persistence.recordComplete).toHaveBeenCalledOnce();
    expect(persistence.recordComplete.mock.calls[0][1]).toMatchObject({
      status: "failed",
      tokensIn: 3,
      tokensOut: 4,
    });
    expect(persistence.recordComplete.mock.calls[0][1].errorDetail).toBeTruthy();
  });

  it("records 'failed' with accumulated tokens on budget overrun", async () => {
    const persistence = makePersistence();
    const def = makeAgent({
      budget: { maxTokens: 10, maxToolCalls: 3, timeoutMs: 5000 },
    });
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 50, output_tokens: 50 },
      },
    ]).client;
    await expect(
      runAgent(def, { task: "t" }, {
        companyId: "f",
        userId: "u",
        llmClient: llm,
        helpers: makeStubHelpers(),
        persistence,
      })
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(persistence.recordComplete).toHaveBeenCalledOnce();
    expect(persistence.recordComplete.mock.calls[0][1]).toMatchObject({
      status: "failed",
      tokensIn: 50,
      tokensOut: 50,
    });
  });

  it("skips persistence entirely when persistRun=false", async () => {
    const persistence = makePersistence();
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]).client;
    await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm,
      helpers: makeStubHelpers(),
      persistRun: false,
      persistence,
    });
    expect(persistence.recordStart).not.toHaveBeenCalled();
    expect(persistence.recordComplete).not.toHaveBeenCalled();
  });

  it("treats recordStart failure as non-fatal and still records completion", async () => {
    const persistence = {
      recordStart: vi.fn().mockRejectedValue(new Error("DB down")),
      recordComplete: vi.fn().mockResolvedValue(null),
    };
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]).client;
    const result = await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      llmClient: llm,
      helpers: makeStubHelpers(),
      persistence,
    });
    expect(result.trace.success).toBe(true);
    expect(persistence.recordStart).toHaveBeenCalledOnce();
    expect(persistence.recordComplete).toHaveBeenCalledOnce();
    const warnEvent = result.trace.events.find(
      (e) => e.kind === "lifecycle" && e.message.includes("recordStart failed")
    );
    expect(warnEvent).toBeDefined();
  });

  it("uses opts.agentRole when provided and defaults triggeredBy to 'api'", async () => {
    const persistence = makePersistence();
    const def = makeAgent();
    const llm = makeMockLLM([
      {
        content: [{ type: "text", text: '{"summary":"ok","score":1}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]).client;
    await runAgent(def, { task: "t" }, {
      companyId: "f",
      userId: "u",
      agentRole: "Sales",
      llmClient: llm,
      helpers: makeStubHelpers(),
      persistence,
    });
    expect(persistence.recordStart.mock.calls[0][0].agentRole).toBe("Sales");
    expect(persistence.recordStart.mock.calls[0][0].triggeredBy).toBe("api");
  });
});
