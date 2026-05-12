/**
 * LLM router — provider-agnostic chat completion.
 *
 * v2 scope (per docs/vision/TRANSITION-PLAN.md, Gap 6): chat-only. Tool-use
 * stays Anthropic-only because tool semantics differ across providers and
 * the existing chat route already special-cases Apollo + CEO tools through
 * @anthropic-ai/sdk.
 *
 * BYOM works by storing per-tenant LLM provider keys in the existing
 * user_api_keys table (already used for tool credentials like Apollo and
 * Instantly). Service names this router recognises:
 *
 *   anthropic        — uses @anthropic-ai/sdk with a per-tenant key
 *   openai           — uses fetch against https://api.openai.com/v1
 *   openai_compat    — uses fetch against a custom base URL (Groq, Together,
 *                       OpenRouter, Anyscale, vLLM, Ollama, …)
 *
 * Default when no per-tenant key is configured: Anthropic + the env-level
 * ANTHROPIC_API_KEY. So existing behavior is unchanged for tenants that
 * haven't opted into BYOM.
 *
 * Tests in test/llm-router.test.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getUserApiKey } from "./db";

export type LLMProvider = "anthropic" | "openai" | "openai_compat";

export interface LLMConfig {
  provider: LLMProvider;
  /** Final model id used by the underlying provider. */
  model: string;
  /** Resolved API key (per-tenant key when present, else env). */
  apiKey: string;
  /** Override for openai_compat. */
  baseURL?: string;
  /** True when the resolution found a per-tenant key; false when the env was the fallback. */
  byom: boolean;
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMCompletionRequest {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  /** Optional explicit model override. */
  model?: string;
}

export interface LLMCompletionResponse {
  text: string;
  model: string;
  provider: LLMProvider;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-4o";

/**
 * Resolve the LLM config for a company. Reads user-supplied keys from
 * user_api_keys in order of preference; falls back to env for Anthropic.
 *
 * Provider preference order when multiple per-tenant keys exist:
 *   openai_compat (most specific) → openai → anthropic
 *
 * This means a tenant that's gone all-in on OpenAI doesn't accidentally
 * route to Anthropic.
 */
export async function getLLMConfigForCompany(
  companyId: string
): Promise<LLMConfig> {
  const tryProvider = async (
    provider: LLMProvider,
    serviceName: string
  ): Promise<{ apiKey: string; meta?: { baseURL?: string; model?: string } } | null> => {
    const raw = await getUserApiKey(companyId, serviceName);
    if (!raw) return null;
    // Some providers store JSON {apiKey, baseURL, model} as a single value when
    // the encrypted_credentials column is used flexibly. Tolerate both shapes.
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof parsed.apiKey === "string") {
        return { apiKey: parsed.apiKey, meta: { baseURL: parsed.baseURL, model: parsed.model } };
      }
    } catch {
      // raw string key (the common case)
    }
    return { apiKey: raw };
  };

  // openai_compat is the most specific — check first
  const compat = await tryProvider("openai_compat", "openai_compat");
  if (compat) {
    return {
      provider: "openai_compat",
      apiKey: compat.apiKey,
      baseURL: compat.meta?.baseURL ?? "https://api.openai.com/v1",
      model: compat.meta?.model ?? DEFAULT_OPENAI_MODEL,
      byom: true,
    };
  }

  const openai = await tryProvider("openai", "openai");
  if (openai) {
    return {
      provider: "openai",
      apiKey: openai.apiKey,
      baseURL: "https://api.openai.com/v1",
      model: openai.meta?.model ?? DEFAULT_OPENAI_MODEL,
      byom: true,
    };
  }

  const anthropic = await tryProvider("anthropic", "anthropic");
  if (anthropic) {
    return {
      provider: "anthropic",
      apiKey: anthropic.apiKey,
      model: anthropic.meta?.model ?? DEFAULT_ANTHROPIC_MODEL,
      byom: true,
    };
  }

  // Fallback to env-level Anthropic key
  return {
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: DEFAULT_ANTHROPIC_MODEL,
    byom: false,
  };
}

/**
 * Run a single chat completion against whatever provider the tenant has
 * configured. Tool-use is NOT supported here — callers that need tools
 * should keep using the Anthropic SDK directly.
 */
export async function createCompletion(
  companyId: string,
  req: LLMCompletionRequest,
  configOverride?: LLMConfig
): Promise<LLMCompletionResponse> {
  const cfg = configOverride ?? (await getLLMConfigForCompany(companyId));
  const model = req.model ?? cfg.model;
  const maxTokens = req.maxTokens ?? 4096;

  if (cfg.provider === "anthropic") {
    return runAnthropic({ ...req, model, maxTokens, apiKey: cfg.apiKey });
  }
  // openai + openai_compat share the same wire protocol
  return runOpenAICompatible({
    ...req,
    model,
    maxTokens,
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL ?? "https://api.openai.com/v1",
    provider: cfg.provider,
  });
}

async function runAnthropic(opts: {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  model: string;
  apiKey: string;
}): Promise<LLMCompletionResponse> {
  const client = opts.apiKey
    ? new Anthropic({ apiKey: opts.apiKey })
    : new Anthropic();
  const result = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
  });
  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  return {
    text,
    model: opts.model,
    provider: "anthropic",
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    },
  };
}

async function runOpenAICompatible(opts: {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  model: string;
  apiKey: string;
  baseURL: string;
  provider: LLMProvider;
  fetchImpl?: typeof fetch;
}): Promise<LLMCompletionResponse> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const body = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages: [
      { role: "system", content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
  const res = await fetchFn(`${opts.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "<unreadable body>");
    throw new Error(
      `LLM router (${opts.provider}) HTTP ${res.status}: ${errText.slice(0, 300)}`
    );
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text,
    model: opts.model,
    provider: opts.provider,
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

/** Exported for unit tests that need to drive the OpenAI-compatible path with a stubbed fetch. */
export const __test__ = { runOpenAICompatible };
