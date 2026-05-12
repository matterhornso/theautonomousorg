/**
 * Unit tests for the Tally ingest endpoint
 * (src/app/api/integrations/tally/route.ts).
 *
 * We test the dependency-injectable runTallyIngest entrypoint with mocked
 * verifyClient + persistInbox + notifyAgents. process.env is set up per-test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runTallyIngest } from "@/app/api/integrations/tally/route";

const TOKEN = "test-tally-token";

function buildHeaders(overrides: Record<string, string> = {}): Headers {
  const h = new Headers();
  h.set("authorization", `Bearer ${TOKEN}`);
  h.set("x-client-cert-fingerprint", "AB:CD:EF:00:11");
  for (const [k, v] of Object.entries(overrides)) h.set(k, v);
  return h;
}

function buildPayload(): string {
  return JSON.stringify({
    firmId: "firm_a",
    ts: 1700000000,
    ledgerEntries: [
      { id: "L1", date: "2026-05-01", amount: 10000, narration: "Rent" },
    ],
  });
}

describe("runTallyIngest — auth", () => {
  beforeEach(() => {
    process.env.TALLY_INGEST_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.TALLY_INGEST_TOKEN;
  });

  it("503 when TALLY_INGEST_TOKEN is unset", async () => {
    delete process.env.TALLY_INGEST_TOKEN;
    const res = await runTallyIngest(buildPayload(), buildHeaders());
    expect(res.status).toBe(503);
  });

  it("401 when bearer token is missing", async () => {
    const headers = new Headers({ "x-client-cert-fingerprint": "ABC" });
    const res = await runTallyIngest(buildPayload(), headers);
    expect(res.status).toBe(401);
  });

  it("401 when bearer token doesn't match", async () => {
    const headers = buildHeaders({ authorization: "Bearer wrong" });
    const res = await runTallyIngest(buildPayload(), headers);
    expect(res.status).toBe(401);
  });

  it("401 when X-Client-Cert-Fingerprint header is missing", async () => {
    const headers = new Headers({ authorization: `Bearer ${TOKEN}` });
    const res = await runTallyIngest(buildPayload(), headers);
    expect(res.status).toBe(401);
  });
});

describe("runTallyIngest — payload validation", () => {
  beforeEach(() => {
    process.env.TALLY_INGEST_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.TALLY_INGEST_TOKEN;
  });

  it("400 on invalid JSON", async () => {
    const res = await runTallyIngest("not-json", buildHeaders(), {
      verifyClient: async () => true,
    });
    expect(res.status).toBe(400);
  });

  it("400 on schema mismatch", async () => {
    const bad = JSON.stringify({ firmId: "firm_a", ts: "string-not-number" });
    const res = await runTallyIngest(bad, buildHeaders(), {
      verifyClient: async () => true,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("issues");
  });

  it("400 when firmId is empty string", async () => {
    const bad = JSON.stringify({ firmId: "", ts: 1700 });
    const res = await runTallyIngest(bad, buildHeaders(), {
      verifyClient: async () => true,
    });
    expect(res.status).toBe(400);
  });
});

describe("runTallyIngest — cert verification", () => {
  beforeEach(() => {
    process.env.TALLY_INGEST_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.TALLY_INGEST_TOKEN;
  });

  it("403 when fingerprint isn't on the firm's allowlist", async () => {
    const verifyClient = vi.fn().mockResolvedValue(false);
    const res = await runTallyIngest(buildPayload(), buildHeaders(), { verifyClient });
    expect(res.status).toBe(403);
    expect(verifyClient).toHaveBeenCalledWith("firm_a", "AB:CD:EF:00:11");
  });

  it("202 when verifyClient passes; persists payload and returns inboxId", async () => {
    const verifyClient = vi.fn().mockResolvedValue(true);
    const persistInbox = vi.fn().mockResolvedValue("tinbox_42");
    const res = await runTallyIngest(buildPayload(), buildHeaders(), {
      verifyClient,
      persistInbox,
    });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ accepted: true, inboxId: "tinbox_42" });
    expect(persistInbox).toHaveBeenCalledTimes(1);
    const [firmId, payload, hash] = persistInbox.mock.calls[0];
    expect(firmId).toBe("firm_a");
    expect(payload.ledgerEntries).toHaveLength(1);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // sha256 hex
  });
});

describe("runTallyIngest — notifyAgents", () => {
  beforeEach(() => {
    process.env.TALLY_INGEST_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.TALLY_INGEST_TOKEN;
  });

  it("invokes notifyAgents on accept", async () => {
    const notifyAgents = vi.fn().mockResolvedValue(undefined);
    const res = await runTallyIngest(buildPayload(), buildHeaders(), {
      verifyClient: async () => true,
      persistInbox: async () => "tinbox_x",
      notifyAgents,
    });
    expect(res.status).toBe(202);
    expect(notifyAgents).toHaveBeenCalledWith("firm_a", "tinbox_x");
  });

  it("does not fail when notifyAgents throws", async () => {
    const notifyAgents = vi.fn().mockRejectedValue(new Error("queue down"));
    const res = await runTallyIngest(buildPayload(), buildHeaders(), {
      verifyClient: async () => true,
      persistInbox: async () => "tinbox_y",
      notifyAgents,
    });
    expect(res.status).toBe(202);
  });
});
