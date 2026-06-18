/**
 * Unit tests for the Fireflies import pipeline (UNIFICATION.md Phase 2).
 *
 * Covers the net-new units, not the full HTTP route (which needs Clerk/tenant
 * mocking covered elsewhere):
 *   1. FirefliesClient GraphQL plumbing (auth header, error surfaces, parsing).
 *   2. transcriptToText speaker formatting.
 *   3. getFirefliesClient env-key resolution (single-tenant v1).
 *   4. existingConversationSourceRefs — the idempotency query importers rely on
 *      (createConversation does not dedupe on its own).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── sql capture mock (same pattern as memory-visibility.test.ts) ───────────
interface Captured {
  text: string;
  values: unknown[];
}
const calls: Captured[] = [];
let sqlRows: unknown[] = [];
const sqlMock = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join(" ? "), values });
    return Promise.resolve(sqlRows);
  }
);
vi.mock("@/lib/db-postgres", () => ({ sql: sqlMock }));

import {
  FirefliesClient,
  transcriptToText,
  getFirefliesClient,
} from "@/lib/fireflies";
import { existingConversationSourceRefs } from "@/lib/knowledge-graph";

describe("transcriptToText", () => {
  it("formats sentences as 'Speaker: text' lines", () => {
    const out = transcriptToText([
      { text: "Hello team", speaker_name: "Asha" },
      { text: "Hi Asha", speaker_name: "Ravi" },
    ]);
    expect(out).toBe("Asha: Hello team\nRavi: Hi Asha");
  });

  it("falls back to 'Speaker' when speaker_name is null", () => {
    expect(transcriptToText([{ text: "Anon line", speaker_name: null }])).toBe(
      "Speaker: Anon line"
    );
  });
});

describe("FirefliesClient", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends a Bearer token and parses transcripts", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          transcripts: [
            {
              id: "ff_1",
              title: "Standup",
              date: "2026-06-01",
              duration: 600,
              sentences: [{ text: "hi", speaker_name: "A" }],
            },
          ],
        },
      }),
    });

    const client = new FirefliesClient("secret-key");
    const out = await client.listTranscripts({ limit: 5 });

    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("ff_1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.fireflies.ai/graphql");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret-key"
    );
    expect(init.body).toContain("transcripts");
  });

  it("throws on a non-ok HTTP response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    const client = new FirefliesClient("bad");
    await expect(client.getCurrentUser()).rejects.toThrow(/401/);
  });

  it("throws on a GraphQL errors payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: "rate limited" }] }),
    });
    const client = new FirefliesClient("k");
    await expect(client.listTranscripts({})).rejects.toThrow(/rate limited/);
  });
});

describe("getFirefliesClient", () => {
  const prev = process.env.FIREFLIES_API_KEY;
  afterEach(() => {
    if (prev === undefined) delete process.env.FIREFLIES_API_KEY;
    else process.env.FIREFLIES_API_KEY = prev;
  });

  it("returns null when the env key is unset", () => {
    delete process.env.FIREFLIES_API_KEY;
    expect(getFirefliesClient()).toBeNull();
  });

  it("returns a client when the env key is set", () => {
    process.env.FIREFLIES_API_KEY = "env-key";
    expect(getFirefliesClient()).toBeInstanceOf(FirefliesClient);
  });
});

describe("existingConversationSourceRefs", () => {
  beforeEach(() => {
    calls.length = 0;
    sqlRows = [];
  });

  it("returns empty set without querying when no refs given", async () => {
    const out = await existingConversationSourceRefs("co-1", "fireflies", []);
    expect(out.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("scopes by company + source and binds the ref array", async () => {
    sqlRows = [{ source_ref: "ff_1" }, { source_ref: "ff_3" }];
    const out = await existingConversationSourceRefs("co-1", "fireflies", [
      "ff_1",
      "ff_2",
      "ff_3",
    ]);
    expect(out).toEqual(new Set(["ff_1", "ff_3"]));
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain("FROM memory_conversations");
    expect(calls[0].text).toContain("source_ref = ANY(");
    expect(calls[0].values).toEqual([
      "co-1",
      "fireflies",
      ["ff_1", "ff_2", "ff_3"],
    ]);
  });
});
