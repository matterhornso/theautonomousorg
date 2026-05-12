import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractMentions,
  dispatchMentions,
} from "@/lib/mention-dispatch";

describe("extractMentions", () => {
  it("returns empty for empty / non-string input", () => {
    expect(extractMentions("")).toEqual([]);
    expect(extractMentions("just plain text, no mentions")).toEqual([]);
  });

  it("finds single-word roles", () => {
    expect(extractMentions("@Sales please pull a list")).toEqual(["Sales"]);
    expect(extractMentions("Asking @Legal for a draft")).toEqual(["Legal"]);
  });

  it("finds multi-word roles preferring the longest match", () => {
    expect(extractMentions("Hand off to @Customer Success")).toEqual([
      "Customer Success",
    ]);
    expect(extractMentions("ping @Front-End Engineering on this")).toEqual([
      "Front-End Engineering",
    ]);
  });

  it("dedupes repeated mentions of the same role", () => {
    expect(
      extractMentions("@Sales and @Sales again, plus one more @Sales")
    ).toEqual(["Sales"]);
  });

  it("preserves order across distinct roles", () => {
    expect(
      extractMentions("first @Legal then @Finance then @Admin")
    ).toEqual(["Legal", "Finance", "Admin"]);
  });

  it("ignores unknown role names so we don't fire phantom relays", () => {
    expect(extractMentions("@Foo @Bar @SomeFakeRole")).toEqual([]);
  });

  it("does not match when @Role is followed by more letters", () => {
    // Avoids picking up `@Salesteam` as Sales
    expect(extractMentions("@Salesteam should handle it")).toEqual([]);
  });

  it("works with multi-line content", () => {
    const text = `
      Let me check with the team.

      @Strategy — does this fit our Q3 plan?
      @Legal — please draft the MSA.
    `;
    expect(extractMentions(text).sort()).toEqual(["Legal", "Strategy"]);
  });
});

describe("dispatchMentions", () => {
  const ORIG_SECRET = process.env.INTERNAL_SECRET;
  const ORIG_BASE = process.env.APP_BASE_URL;

  beforeEach(() => {
    process.env.INTERNAL_SECRET = "test-secret";
    process.env.APP_BASE_URL = "http://localhost:9999";
  });

  afterEach(() => {
    if (ORIG_SECRET === undefined) delete process.env.INTERNAL_SECRET;
    else process.env.INTERNAL_SECRET = ORIG_SECRET;
    if (ORIG_BASE === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = ORIG_BASE;
  });

  it("returns empty when no mentions exist", async () => {
    const fetchImpl = vi.fn();
    const out = await dispatchMentions({
      fromAgentId: "a1",
      content: "no mentions here",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips silently when INTERNAL_SECRET is missing", async () => {
    delete process.env.INTERNAL_SECRET;
    const fetchImpl = vi.fn();
    const out = await dispatchMentions({
      fromAgentId: "a1",
      content: "@Sales help",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toEqual([{ role: "Sales", status: "skipped" }]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fires one relay call per unique mention with internal-secret header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "ack", status: "done" }),
    });
    const out = await dispatchMentions({
      fromAgentId: "src-agent",
      conversationId: "conv-1",
      content: "@Legal please draft and @Finance please project",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.status === "done")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall[0]).toBe("http://localhost:9999/api/agents/relay");
    const init = firstCall[1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-internal-secret"]).toBe(
      "test-secret"
    );
    const body = JSON.parse(init.body as string);
    expect(body.sourceAgentId).toBe("src-agent");
    expect(body.conversationId).toBe("conv-1");
    expect(["Legal", "Finance"]).toContain(body.targetRole);
  });

  it("captures error status when relay returns non-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const out = await dispatchMentions({
      fromAgentId: "src",
      content: "@Sales ping",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toEqual([{ role: "Sales", status: "error", error: "HTTP 500" }]);
  });

  it("captures thrown error per-mention without aborting the batch", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: "ok", status: "done" }),
      });
    const out = await dispatchMentions({
      fromAgentId: "src",
      content: "@Legal first then @Sales",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toHaveLength(2);
    expect(out[0].status).toBe("error");
    expect(out[0].error).toContain("network down");
    expect(out[1].status).toBe("done");
  });
});
