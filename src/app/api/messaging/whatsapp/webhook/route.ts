/**
 * Inbound WhatsApp webhook (Gupshup BSP).
 *
 * Flow:
 *   1. Read raw body (we need the bytes for HMAC, not the parsed JSON).
 *   2. Validate the X-Hub-Signature-256 header against WHATSAPP_WEBHOOK_SECRET.
 *   3. Parse the Gupshup payload into a normalized InboundMessage.
 *   4. Route to (firmId, agentId) via routeInboundMessage().
 *   5. Dispatch to AgentRunner if a matching agent is found.
 *   6. Always 200 OK so Gupshup doesn't retry; failures are logged.
 *
 * The runtime intentionally does NOT block on AgentRunner. WhatsApp's webhook
 * SLA is short (a few seconds); we ack the BSP immediately and let the agent
 * run async. For test predictability the helper exposes `runWhatsAppWebhook`
 * which takes injected dependencies and returns the response synchronously.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  validateWebhookSignature,
  routeInboundMessage,
  type InboundMessage,
  type SenderLookupFn,
} from "@/lib/whatsapp";

// ─── Gupshup payload typing ────────────────────────────────────────────────
// Gupshup wraps the WhatsApp message in their own envelope. We only extract
// the fields we need; the rest goes into `raw` for audit logging.
interface GupshupPayload {
  type?: string;
  payload?: {
    id?: string;
    type?: string;
    source?: string;
    payload?: {
      text?: string;
      id?: string; // button id for interactive replies
      title?: string;
    };
    sender?: { phone?: string };
    timestamp?: string | number;
  };
}

function parseGupshup(p: GupshupPayload): InboundMessage | null {
  const inner = p.payload;
  if (!inner) return null;
  const from = inner.sender?.phone ?? inner.source;
  if (!from) return null;
  const messageId = inner.id ?? "unknown";
  const ts = inner.timestamp;
  const timestamp =
    typeof ts === "number" ? ts : ts ? Number(ts) || Date.now() : Date.now();
  const text = inner.payload?.text ?? "";
  let buttonReply: { id: string; title: string } | undefined;
  if (inner.type === "button_reply" && inner.payload?.id && inner.payload?.title) {
    buttonReply = { id: inner.payload.id, title: inner.payload.title };
  }
  return {
    from: from.startsWith("+") ? from : `+${from}`,
    text,
    messageId,
    timestamp,
    buttonReply,
    raw: p,
  };
}

// ─── Dependency-injectable handler ─────────────────────────────────────────

export interface RunWhatsAppWebhookDeps {
  webhookSecret?: string;
  /** Override sender lookup (tests). */
  lookup?: SenderLookupFn;
  /**
   * Dispatch a routed inbound message to the agent runtime. Tests pass a
   * mock; production wires this to runAgent + the persisted AgentDefinition
   * registry (the registry lands in a follow-up PR; until then dispatch is
   * a no-op that just logs).
   */
  dispatch?: (
    routed: { firmId: string; agentId?: string; userId?: string; from: string; text: string }
  ) => Promise<void>;
}

export async function runWhatsAppWebhook(
  rawBody: string,
  signatureHeader: string | null,
  deps: RunWhatsAppWebhookDeps = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = deps.webhookSecret ?? process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) {
    return {
      status: 503,
      body: { error: "WhatsApp webhook secret not configured" },
    };
  }
  if (!validateWebhookSignature(rawBody, signatureHeader, secret)) {
    return { status: 401, body: { error: "Invalid signature" } };
  }
  let payload: GupshupPayload;
  try {
    payload = JSON.parse(rawBody) as GupshupPayload;
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }
  // Only `message` events carry user input we route. Status events (read,
  // delivered, sent) are acknowledged and ignored.
  if (payload.type && payload.type !== "message") {
    return { status: 200, body: { received: payload.type } };
  }
  const inbound = parseGupshup(payload);
  if (!inbound) {
    return { status: 200, body: { ignored: "no parseable message" } };
  }
  const routed = await routeInboundMessage(inbound, deps.lookup);
  if ("unknownSender" in routed) {
    // 200 OK so Gupshup doesn't retry; logged for SPOC enrolment workflow.
    console.warn("[whatsapp] unknown sender", inbound.from);
    return { status: 200, body: { ignored: "unknown sender" } };
  }
  if (deps.dispatch) {
    try {
      await deps.dispatch({
        firmId: routed.firmId,
        agentId: routed.agentId,
        userId: routed.userId,
        from: routed.from,
        text: routed.text,
      });
    } catch (err) {
      console.warn("[whatsapp] dispatch failed:", err);
    }
  }
  return {
    status: 200,
    body: { received: true, firmId: routed.firmId, agentId: routed.agentId },
  };
}

// ─── Next.js handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-hub-signature-256") ??
    request.headers.get("x-gupshup-signature");
  const result = await runWhatsAppWebhook(rawBody, signature);
  return NextResponse.json(result.body, { status: result.status });
}

// Gupshup verification GET (some BSPs ping with a challenge param).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ ok: true });
}
