/**
 * Unit tests for the WhatsApp webhook + callback Next.js routes.
 *
 * We test the dependency-injectable handlers (runWhatsAppWebhook,
 * runWhatsAppCallback) because the Next.js NextRequest wrapper is just a
 * fetch around them. The dispatch + persist + lookup deps are mocked so
 * no DB or BSP calls occur.
 */

import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";
import { runWhatsAppWebhook } from "@/app/api/messaging/whatsapp/webhook/route";
import { runWhatsAppCallback } from "@/app/api/messaging/whatsapp/callback/route";
import { signCallbackUrl } from "@/lib/whatsapp";

const SECRET = "test-webhook-secret";
const CB_SECRET = "test-callback-secret";

function sign(rawBody: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(rawBody).digest("hex");
}

describe("runWhatsAppWebhook", () => {
  it("rejects when the webhook secret is not configured", async () => {
    const res = await runWhatsAppWebhook("{}", null, { webhookSecret: undefined });
    expect(res.status).toBe(503);
  });

  it("rejects with 401 when the signature is invalid", async () => {
    const res = await runWhatsAppWebhook("{}", "sha256=deadbeef", { webhookSecret: SECRET });
    expect(res.status).toBe(401);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await runWhatsAppWebhook("not-json", sign("not-json"), {
      webhookSecret: SECRET,
    });
    expect(res.status).toBe(400);
  });

  it("ignores non-message events with 200", async () => {
    const body = JSON.stringify({ type: "message-event", payload: {} });
    const res = await runWhatsAppWebhook(body, sign(body), { webhookSecret: SECRET });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: "message-event" });
  });

  it("returns ignored when the sender is unknown", async () => {
    const body = JSON.stringify({
      type: "message",
      payload: {
        id: "msg_1",
        type: "text",
        sender: { phone: "919999900000" },
        timestamp: 1700000000,
        payload: { text: "hello" },
      },
    });
    const res = await runWhatsAppWebhook(body, sign(body), {
      webhookSecret: SECRET,
      lookup: async () => null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ignored: "unknown sender" });
  });

  it("dispatches the routed message when the sender is known", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const body = JSON.stringify({
      type: "message",
      payload: {
        id: "msg_2",
        type: "text",
        sender: { phone: "919999911111" },
        timestamp: 1700000001,
        payload: { text: "submit bill ₹500" },
      },
    });
    const res = await runWhatsAppWebhook(body, sign(body), {
      webhookSecret: SECRET,
      lookup: async (phone) => {
        if (phone === "+919999911111") {
          return { firmId: "firm_a", defaultAgentId: "finance_a4_bank_recon", userId: "user_42" };
        }
        return null;
      },
      dispatch,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ firmId: "firm_a", agentId: "finance_a4_bank_recon" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      firmId: "firm_a",
      agentId: "finance_a4_bank_recon",
      from: "+919999911111",
      text: "submit bill ₹500",
    });
  });

  it("does not crash when dispatch throws", async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error("agent runtime down"));
    const body = JSON.stringify({
      type: "message",
      payload: {
        id: "msg_3",
        type: "text",
        sender: { phone: "919999911111" },
        timestamp: 1700000003,
        payload: { text: "x" },
      },
    });
    const res = await runWhatsAppWebhook(body, sign(body), {
      webhookSecret: SECRET,
      lookup: async () => ({ firmId: "firm_a", defaultAgentId: "agent_x" }),
      dispatch,
    });
    expect(res.status).toBe(200);
  });
});

describe("runWhatsAppCallback", () => {
  function makePayload(overrides: Partial<Parameters<typeof signCallbackUrl>[0]> = {}) {
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    return {
      cardId: "card_1",
      firmId: "firm_a",
      agentId: "agent_x",
      runId: "run_1",
      action: "approve" as const,
      expiry,
      data: { taskId: "t1" },
      ...overrides,
    };
  }

  function buildSigned(payload = makePayload()): { p: string; s: string } {
    const url = signCallbackUrl(payload, CB_SECRET, "https://example.com");
    const parsed = new URL(url);
    return {
      p: parsed.searchParams.get("p")!,
      s: parsed.searchParams.get("s")!,
    };
  }

  it("rejects when the callback secret is not configured", async () => {
    const res = await runWhatsAppCallback("p", "s", { callbackSecret: undefined });
    expect(res.status).toBe(503);
  });

  it("400 when missing query params", async () => {
    const res = await runWhatsAppCallback(null, null, { callbackSecret: CB_SECRET });
    expect(res.status).toBe(400);
  });

  it("401 on invalid signature", async () => {
    const { p } = buildSigned();
    const res = await runWhatsAppCallback(p, "deadbeef", { callbackSecret: CB_SECRET });
    expect(res.status).toBe(401);
  });

  it("401 on expired callback", async () => {
    const expiredPayload = makePayload({ expiry: Math.floor(Date.now() / 1000) - 100 });
    const { p, s } = buildSigned(expiredPayload);
    const res = await runWhatsAppCallback(p, s, { callbackSecret: CB_SECRET });
    expect(res.status).toBe(401);
  });

  it("persists a fresh approval and runs onResolved exactly once", async () => {
    const persist = vi.fn().mockResolvedValue({ created: true, id: "appcb_1" });
    const onResolved = vi.fn().mockResolvedValue(undefined);
    const { p, s } = buildSigned();
    const res = await runWhatsAppCallback(p, s, {
      callbackSecret: CB_SECRET,
      persist,
      onResolved,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, action: "approve", idempotent: false });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("idempotency: second click does not invoke onResolved again", async () => {
    const persist = vi
      .fn()
      .mockResolvedValueOnce({ created: true, id: "appcb_1" })
      .mockResolvedValueOnce({ created: false, id: "appcb_1" });
    const onResolved = vi.fn().mockResolvedValue(undefined);
    const { p, s } = buildSigned();
    const r1 = await runWhatsAppCallback(p, s, {
      callbackSecret: CB_SECRET,
      persist,
      onResolved,
    });
    const r2 = await runWhatsAppCallback(p, s, {
      callbackSecret: CB_SECRET,
      persist,
      onResolved,
    });
    expect(r1.body).toMatchObject({ idempotent: false });
    expect(r2.body).toMatchObject({ idempotent: true });
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("does not fail when onResolved throws", async () => {
    const persist = vi.fn().mockResolvedValue({ created: true, id: "x" });
    const onResolved = vi.fn().mockRejectedValue(new Error("downstream broken"));
    const { p, s } = buildSigned();
    const res = await runWhatsAppCallback(p, s, {
      callbackSecret: CB_SECRET,
      persist,
      onResolved,
    });
    expect(res.status).toBe(200);
  });
});
