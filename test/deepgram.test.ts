import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isDeepgramConfigured,
  transcribeAudioFromUrl,
  __test__,
} from "@/lib/deepgram";

const ORIG_KEY = process.env.DEEPGRAM_API_KEY;

beforeEach(() => {
  process.env.DEEPGRAM_API_KEY = "test-key";
});
afterEach(() => {
  if (ORIG_KEY === undefined) delete process.env.DEEPGRAM_API_KEY;
  else process.env.DEEPGRAM_API_KEY = ORIG_KEY;
});

describe("isDeepgramConfigured", () => {
  it("reflects the env var", () => {
    expect(isDeepgramConfigured()).toBe(true);
    delete process.env.DEEPGRAM_API_KEY;
    expect(isDeepgramConfigured()).toBe(false);
  });
});

describe("parseTranscript", () => {
  it("prefers utterances over channel alternatives", () => {
    const out = __test__.parseTranscript({
      metadata: { duration: 12.3, detected_language: "en" },
      results: {
        utterances: [
          { transcript: "first utterance" },
          { transcript: "second utterance" },
        ],
        channels: [
          { alternatives: [{ transcript: "alt fallback should be ignored" }] },
        ],
      },
    });
    expect(out.transcript).toBe("first utterance\n\nsecond utterance");
    expect(out.durationSec).toBe(12.3);
    expect(out.language).toBe("en");
  });

  it("falls back to channel alternatives when utterances are empty", () => {
    const out = __test__.parseTranscript({
      results: {
        channels: [
          { alternatives: [{ transcript: "single alternative" }] },
        ],
      },
    });
    expect(out.transcript).toBe("single alternative");
  });

  it("reads model name from models[] when present", () => {
    const out = __test__.parseTranscript({
      metadata: { models: [{ name: "nova-3-medical" }] },
      results: { channels: [{ alternatives: [{ transcript: "x" }] }] },
    });
    expect(out.model).toBe("nova-3-medical");
  });

  it("reads model name from model_info map as fallback", () => {
    const out = __test__.parseTranscript({
      metadata: { model_info: { "model-uuid-x": { name: "nova-3" } } },
      results: { channels: [{ alternatives: [{ transcript: "x" }] }] },
    });
    expect(out.model).toBe("nova-3");
  });

  it("returns empty transcript without throwing on a malformed payload", () => {
    const out = __test__.parseTranscript({});
    expect(out.transcript).toBe("");
    expect(out.model).toBe("nova-3");
  });
});

describe("transcribeAudioFromUrl", () => {
  it("returns null without DEEPGRAM_API_KEY", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const fetchImpl = vi.fn();
    const out = await transcribeAudioFromUrl("https://x/y.mp3", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs the URL to Deepgram and parses the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: { duration: 30, detected_language: "en" },
        results: {
          utterances: [{ transcript: "hello world" }],
        },
      }),
    });
    const out = await transcribeAudioFromUrl("https://x/y.mp3", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out?.transcript).toBe("hello world");
    expect(out?.durationSec).toBe(30);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("api.deepgram.com/v1/listen");
    expect(String(url)).toContain("model=nova-3");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Token test-key",
    });
    const body = JSON.parse(((init as RequestInit).body as string) ?? "{}");
    expect(body.url).toBe("https://x/y.mp3");
  });

  it("throws with HTTP status on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => "out of credit",
    });
    await expect(
      transcribeAudioFromUrl("https://x/y.mp3", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow(/402/);
  });

  it("honors a language override and skips detect_language", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: { utterances: [{ transcript: "x" }] } }),
    });
    await transcribeAudioFromUrl("https://x/y.mp3", {
      language: "hi",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("language=hi");
    expect(String(url)).not.toContain("detect_language=true");
  });
});
