import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAnthropicCreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getUserApiKey: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate };
  },
}));

import { getLLMConfigForCompany, createCompletion, __test__ } from "@/lib/llm-router";
import { getUserApiKey } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "env-key";
});

describe("getLLMConfigForCompany — provider preference", () => {
  it("falls back to env Anthropic when no user keys exist", async () => {
    (getUserApiKey as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const cfg = await getLLMConfigForCompany("co-1");
    expect(cfg.provider).toBe("anthropic");
    expect(cfg.apiKey).toBe("env-key");
    expect(cfg.byom).toBe(false);
  });

  it("picks per-tenant anthropic key when supplied", async () => {
    (getUserApiKey as ReturnType<typeof vi.fn>).mockImplementation(
      async (_co: string, service: string) =>
        service === "anthropic" ? "user-anthropic-key" : undefined
    );
    const cfg = await getLLMConfigForCompany("co-1");
    expect(cfg.provider).toBe("anthropic");
    expect(cfg.apiKey).toBe("user-anthropic-key");
    expect(cfg.byom).toBe(true);
  });

  it("picks openai when openai key is supplied and anthropic is not", async () => {
    (getUserApiKey as ReturnType<typeof vi.fn>).mockImplementation(
      async (_co: string, service: string) =>
        service === "openai" ? "user-openai-key" : undefined
    );
    const cfg = await getLLMConfigForCompany("co-1");
    expect(cfg.provider).toBe("openai");
    expect(cfg.apiKey).toBe("user-openai-key");
    expect(cfg.baseURL).toBe("https://api.openai.com/v1");
    expect(cfg.model).toBe("gpt-4o");
  });

  it("prefers openai_compat over openai over anthropic", async () => {
    (getUserApiKey as ReturnType<typeof vi.fn>).mockImplementation(
      async (_co: string, service: string) => {
        if (service === "openai_compat")
          return JSON.stringify({
            apiKey: "groq-key",
            baseURL: "https://api.groq.com/openai/v1",
            model: "llama-3.3-70b",
          });
        if (service === "openai") return "openai-key";
        if (service === "anthropic") return "anthropic-key";
        return undefined;
      }
    );
    const cfg = await getLLMConfigForCompany("co-1");
    expect(cfg.provider).toBe("openai_compat");
    expect(cfg.apiKey).toBe("groq-key");
    expect(cfg.baseURL).toBe("https://api.groq.com/openai/v1");
    expect(cfg.model).toBe("llama-3.3-70b");
    expect(cfg.byom).toBe(true);
  });

  it("treats a raw string as the api key (no JSON wrapping)", async () => {
    (getUserApiKey as ReturnType<typeof vi.fn>).mockImplementation(
      async (_co: string, service: string) =>
        service === "anthropic" ? "raw-secret-not-json" : undefined
    );
    const cfg = await getLLMConfigForCompany("co-1");
    expect(cfg.apiKey).toBe("raw-secret-not-json");
  });
});

describe("createCompletion — Anthropic path", () => {
  it("routes Anthropic config to the SDK and returns text + usage", async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "hello back" }],
      usage: { input_tokens: 12, output_tokens: 4 },
    });
    const out = await createCompletion(
      "co-1",
      {
        system: "you are helpful",
        messages: [{ role: "user", content: "hi" }],
      },
      {
        provider: "anthropic",
        apiKey: "key",
        model: "claude-sonnet-4-6",
        byom: false,
      }
    );
    expect(out.text).toBe("hello back");
    expect(out.provider).toBe("anthropic");
    expect(out.usage.input_tokens).toBe(12);
    expect(mockAnthropicCreate).toHaveBeenCalled();
  });
});

describe("runOpenAICompatible — wire protocol", () => {
  it("posts in OpenAI chat-completions shape and parses the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "openai response" } }],
        usage: { prompt_tokens: 20, completion_tokens: 8 },
      }),
    });
    const out = await __test__.runOpenAICompatible({
      system: "sys",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 1024,
      model: "gpt-4o",
      apiKey: "user-key",
      baseURL: "https://api.openai.com/v1",
      provider: "openai",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out.text).toBe("openai response");
    expect(out.usage.input_tokens).toBe(20);
    expect(out.usage.output_tokens).toBe(8);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer user-key",
        }),
      })
    );
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o");
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hello" });
  });

  it("throws on non-2xx with status code in the message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limit",
    });
    await expect(
      __test__.runOpenAICompatible({
        system: "s",
        messages: [{ role: "user", content: "x" }],
        maxTokens: 100,
        model: "gpt-4o",
        apiKey: "k",
        baseURL: "https://api.openai.com/v1",
        provider: "openai",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow(/429/);
  });
});
