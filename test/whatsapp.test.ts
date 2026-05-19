/**
 * Unit tests for src/lib/whatsapp.ts.
 *
 * Covers:
 *   - HMAC signed callback URLs (sign + verify round-trip + tamper rejection)
 *   - Webhook signature validation (positive + negative)
 *   - sendApprovalCard with mocked fetch (Gupshup HTTP)
 *   - sendNotification (text + template) with mocked fetch
 *   - Inbound message routing (known + unknown sender)
 *   - Dev-mode behavior (no creds = log + return fake id)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signCallbackUrl,
  verifyCallbackUrl,
  validateWebhookSignature,
  buildWhatsAppHelper,
  routeInboundMessage,
  type CallbackPayload,
} from "@/lib/whatsapp";

const SECRET = "test-callback-secret-32-chars-minimum";
const BASE_URL = "https://test.example";

const validPayload: CallbackPayload = {
  cardId: "card_abc",
  firmId: "firm_jaa",
  agentId: "finance_a4_bank_recon",
  runId: "run_xyz",
  action: "approve",
  expiry: Math.floor(Date.now() / 1000) + 3600,
  data: { invoiceId: "INV-001" },
};

describe("signCallbackUrl + verifyCallbackUrl", () => {
  it("round-trips a valid payload", () => {
    const url = signCallbackUrl(validPayload, SECRET, BASE_URL);
    expect(url).toMatch(/^https:\/\/test\.example\/api\/messaging\/whatsapp\/callback\?p=/);
    const u = new URL(url);
    const encoded = u.searchParams.get("p")!;
    const sig = u.searchParams.get("s")!;
    const recovered = verifyCallbackUrl(encoded, sig, SECRET);
    expect(recovered).not.toBeNull();
    expect(recovered!.cardId).toBe("card_abc");
    expect(recovered!.action).toBe("approve");
    expect(recovered!.data).toEqual({ invoiceId: "INV-001" });
  });

  it("rejects a tampered signature", () => {
    const url = signCallbackUrl(validPayload, SECRET, BASE_URL);
    const u = new URL(url);
    const encoded = u.searchParams.get("p")!;
    const tamperedSig = "0".repeat(64);
    expect(verifyCallbackUrl(encoded, tamperedSig, SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const url = signCallbackUrl(validPayload, SECRET, BASE_URL);
    const u = new URL(url);
    const sig = u.searchParams.get("s")!;
    const tamperedEncoded = Buffer.from(
      JSON.stringify({ ...validPayload, action: "reject" })
    ).toString("base64url");
    expect(verifyCallbackUrl(tamperedEncoded, sig, SECRET)).toBeNull();
  });

  it("rejects a wrong secret", () => {
    const url = signCallbackUrl(validPayload, SECRET, BASE_URL);
    const u = new URL(url);
    const encoded = u.searchParams.get("p")!;
    const sig = u.searchParams.get("s")!;
    expect(verifyCallbackUrl(encoded, sig, "different-secret")).toBeNull();
  });

  it("rejects an expired payload", () => {
    const expired: CallbackPayload = {
      ...validPayload,
      expiry: Math.floor(Date.now() / 1000) - 60,
    };
    const url = signCallbackUrl(expired, SECRET, BASE_URL);
    const u = new URL(url);
    const encoded = u.searchParams.get("p")!;
    const sig = u.searchParams.get("s")!;
    expect(verifyCallbackUrl(encoded, sig, SECRET)).toBeNull();
  });

  it("rejects malformed encoded body", () => {
    expect(verifyCallbackUrl("not-valid-base64-!@#$", "0".repeat(64), SECRET)).toBeNull();
  });
});

describe("validateWebhookSignature", () => {
  const body = '{"type":"message","payload":{"text":"hi"}}';
  // Pre-computed via openssl: echo -n "$body" | openssl dgst -sha256 -hmac "$secret"
  const secret = "webhook-test-secret";
  let sig: string;
  beforeEach(() => {
    // Compute fresh sig at test time so we don't have to hardcode.
    const { createHmac } = require("crypto");
    sig = createHmac("sha256", secret).update(body).digest("hex");
  });

  it("accepts a valid signature with bare-hex form", () => {
    expect(validateWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("accepts a valid signature with sha256= prefix", () => {
    expect(validateWebhookSignature(body, `sha256=${sig}`, secret)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(validateWebhookSignature(body, "0".repeat(64), secret)).toBe(false);
  });

  it("rejects null/missing header", () => {
    expect(validateWebhookSignature(body, null, secret)).toBe(false);
  });

  it("rejects body tampering", () => {
    const tampered = body + " ";
    expect(validateWebhookSignature(tampered, sig, secret)).toBe(false);
  });
});

describe("buildWhatsAppHelper.sendApprovalCard", () => {
  it("calls Gupshup with interactive button message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "gs_msg_1", status: "submitted" }),
    } as Response);

    const helper = buildWhatsAppHelper(
      { firmId: "firm_jaa", agentId: "agent_1", runId: "run_1" },
      {
        gupshupApiKey: "test-key",
        gupshupAppName: "TheAutonomous",
        gupshupSourceNumber: "+919999999999",
        callbackSecret: SECRET,
        baseUrl: BASE_URL,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }
    );

    const result = await helper.sendApprovalCard({
      to: "+919876543210",
      title: "Approve invoice INV-001",
      body: "₹50,000 to ACME Corp. Approve to post to Tally.",
      payload: { invoiceId: "INV-001", amount: 50000 },
    });

    expect(result.cardId).toMatch(/^card_/);
    expect(result.messageId).toBe("gs_msg_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.gupshup.io/wa/api/v1/msg");
    expect(init.headers.apikey).toBe("test-key");
    expect(init.body).toContain("destination=%2B919876543210");
    // Message body should contain the interactive button payload. Use
    // URLSearchParams to handle form-urlencoded properly (`+` -> space).
    const sent = new URLSearchParams(init.body).get("message")!;
    expect(sent).toContain('"type":"interactive"');
    expect(sent).toContain("Approve invoice INV-001");
  });

  it("propagates Gupshup HTTP errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Invalid API key",
    } as Response);

    const helper = buildWhatsAppHelper(
      { firmId: "firm_jaa", agentId: "agent_1", runId: "run_1" },
      {
        gupshupApiKey: "bad-key",
        gupshupAppName: "TheAutonomous",
        gupshupSourceNumber: "+919999999999",
        callbackSecret: SECRET,
        baseUrl: BASE_URL,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }
    );

    await expect(
      helper.sendApprovalCard({
        to: "+919876543210",
        title: "Test",
        body: "Test",
        payload: {},
      })
    ).rejects.toThrow(/Gupshup send failed.*401/);
  });

  it("falls back to dev-mode when creds are missing", async () => {
    const fetchMock = vi.fn();
    const helper = buildWhatsAppHelper(
      { firmId: "firm_jaa", agentId: "agent_1", runId: "run_1" },
      {
        gupshupApiKey: undefined,
        callbackSecret: SECRET,
        baseUrl: BASE_URL,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }
    );

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await helper.sendApprovalCard({
      to: "+919876543210",
      title: "Test",
      body: "Test",
      payload: {},
    });
    expect(result.messageId).toMatch(/^dev_/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("requires WHATSAPP_CALLBACK_SECRET", async () => {
    const helper = buildWhatsAppHelper(
      { firmId: "f", agentId: "a", runId: "r" },
      { callbackSecret: undefined }
    );
    await expect(
      helper.sendApprovalCard({ to: "+1", title: "t", body: "b", payload: {} })
    ).rejects.toThrow(/WHATSAPP_CALLBACK_SECRET is required/);
  });
});

describe("buildWhatsAppHelper.sendNotification", () => {
  it("sends a text message in dev mode", async () => {
    const helper = buildWhatsAppHelper(
      { firmId: "f", agentId: "a", runId: "r" },
      { gupshupApiKey: undefined, callbackSecret: SECRET, baseUrl: BASE_URL }
    );
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await helper.sendNotification({
      to: "+919876543210",
      body: "Bank recon complete: 0 exceptions.",
    });
    expect(result.messageId).toMatch(/^dev_/);
    consoleSpy.mockRestore();
  });

  it("sends a template message with parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "gs_msg_tpl", status: "submitted" }),
    } as Response);
    const helper = buildWhatsAppHelper(
      { firmId: "f", agentId: "a", runId: "r" },
      {
        gupshupApiKey: "k",
        gupshupAppName: "TheAutonomous",
        gupshupSourceNumber: "+91s",
        callbackSecret: SECRET,
        baseUrl: BASE_URL,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }
    );
    await helper.sendNotification({
      to: "+919876543210",
      body: "fallback",
      template: "ar_escalation_day_30",
      templateParams: ["ACME Corp", "₹50,000", "30 days"],
    });
    const init = fetchMock.mock.calls[0][1];
    const sent = new URLSearchParams(init.body).get("message")!;
    expect(sent).toContain("ar_escalation_day_30");
    expect(sent).toContain("ACME Corp");
    expect(sent).toContain("30 days");
  });
});

describe("routeInboundMessage", () => {
  const baseMsg = {
    from: "+919876543210",
    text: "Photo of bill",
    messageId: "wamid_001",
    timestamp: Date.now(),
    raw: {},
  };

  it("routes a known sender to their firm", async () => {
    const lookup = vi.fn().mockResolvedValue({
      firmId: "firm_jaa",
      defaultAgentId: "finance_r1_ope_intake",
      displayName: "Anil Partner",
    });
    const result = await routeInboundMessage(baseMsg, lookup);
    expect("firmId" in result && result.firmId).toBe("firm_jaa");
    expect("agentId" in result && result.agentId).toBe("finance_r1_ope_intake");
    expect(lookup).toHaveBeenCalledWith("+919876543210");
  });

  it("returns unknownSender for an unmapped phone", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const result = await routeInboundMessage(baseMsg, lookup);
    expect("unknownSender" in result && result.unknownSender).toBe(true);
  });

  it("preserves button reply payload through routing", async () => {
    const msg = {
      ...baseMsg,
      buttonReply: { id: "approve:card_abc", title: "Approve" },
    };
    const lookup = vi.fn().mockResolvedValue({ firmId: "firm_jaa" });
    const result = await routeInboundMessage(msg, lookup);
    expect("buttonReply" in result && result.buttonReply?.id).toBe("approve:card_abc");
  });
});
