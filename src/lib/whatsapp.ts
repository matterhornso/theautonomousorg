/**
 * WhatsApp BSP router + WhatsAppHelper implementation (W4).
 *
 * Architecture (eng-review locked at 1C-B):
 *   ONE platform Gupshup number with sender-firm routing. Sender phone →
 *   firm + role lookup → correct agent cluster. Templates approved once
 *   apply across all firms.
 *
 * What this module does:
 *   1. Sends outbound WhatsApp messages via Gupshup's HTTP API.
 *      - sendApprovalCard: interactive button message with signed callback URL
 *      - sendNotification: template (utility) or session-window text message
 *   2. Implements signed-callback-URL HMAC for approval flows so:
 *      - Buttons in WhatsApp can be clicked outside the session window
 *      - Idempotency: same callback URL clicked twice = same outcome
 *      - Audit row written before action executes
 *   3. Validates inbound webhook signatures from Gupshup.
 *   4. Routes inbound messages to the correct firm + agent based on sender phone.
 *
 * Tests: src/lib/whatsapp.test.ts mocks fetch + the messaging_users table
 * lookup so unit tests run without a Gupshup account or database.
 *
 * Configuration (env vars):
 *   GUPSHUP_API_KEY           — Gupshup BSP API key (required for production)
 *   GUPSHUP_APP_NAME          — Gupshup application name
 *   GUPSHUP_SOURCE_NUMBER     — the platform-shared WhatsApp Business number
 *   WHATSAPP_WEBHOOK_SECRET   — HMAC secret for verifying inbound webhooks
 *   WHATSAPP_CALLBACK_SECRET  — HMAC secret for signing approval callback URLs
 *   APP_BASE_URL              — used to construct callback URLs
 *
 * Defaults: when GUPSHUP_API_KEY is missing, sends are logged + skipped (dev mode).
 */

import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import type {
  ApprovalCardOptions,
  ApprovalCardResult,
  WhatsAppHelper,
} from "./agent-sdk-helpers";

// ─── Config ────────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  gupshupApiKey?: string;
  gupshupAppName?: string;
  gupshupSourceNumber?: string;
  webhookSecret?: string;
  callbackSecret?: string;
  baseUrl?: string;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
}

function getConfig(overrides?: Partial<WhatsAppConfig>): WhatsAppConfig {
  return {
    gupshupApiKey: overrides?.gupshupApiKey ?? process.env.GUPSHUP_API_KEY,
    gupshupAppName: overrides?.gupshupAppName ?? process.env.GUPSHUP_APP_NAME,
    gupshupSourceNumber: overrides?.gupshupSourceNumber ?? process.env.GUPSHUP_SOURCE_NUMBER,
    webhookSecret: overrides?.webhookSecret ?? process.env.WHATSAPP_WEBHOOK_SECRET,
    callbackSecret: overrides?.callbackSecret ?? process.env.WHATSAPP_CALLBACK_SECRET,
    baseUrl: overrides?.baseUrl ?? process.env.APP_BASE_URL ?? "https://theautonomous.org",
    fetchImpl: overrides?.fetchImpl ?? globalThis.fetch,
  };
}

// ─── Signed callback URL helpers ───────────────────────────────────────────
// HMAC of {firmId, agentId, runId, action, expiry}. The platform's webhook
// route validates the signature before executing. Idempotency on duplicate
// clicks via a one-time-use audit row keyed on the callback id.

export interface CallbackPayload {
  /** Logical id for this approval card; idempotency key. */
  cardId: string;
  firmId: string;
  agentId: string;
  runId: string;
  action: "approve" | "reject" | "escalate";
  /** Unix epoch seconds. */
  expiry: number;
  /** Opaque payload the agent provided when sending the card. */
  data: Record<string, unknown>;
}

export function signCallbackUrl(payload: CallbackPayload, secret: string, baseUrl: string): string {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  const encoded = Buffer.from(body).toString("base64url");
  return `${baseUrl}/api/messaging/whatsapp/callback?p=${encoded}&s=${sig}`;
}

export function verifyCallbackUrl(
  encoded: string,
  signature: string,
  secret: string
): CallbackPayload | null {
  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = createHmac("sha256", secret).update(body).digest("hex");
  if (!safeEqualHex(signature, expectedSig)) return null;
  let payload: CallbackPayload;
  try {
    payload = JSON.parse(body) as CallbackPayload;
  } catch {
    return null;
  }
  if (typeof payload.expiry !== "number") return null;
  if (payload.expiry < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// ─── Webhook signature validation ──────────────────────────────────────────
// Gupshup signs inbound webhook bodies with a shared secret via HMAC-SHA256.
// Header name: X-Hub-Signature-256 (or vendor-specific). Validate before
// processing to reject spoofed messages.

export function validateWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  // Accept both "sha256=<hex>" and bare hex.
  const sig = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(sig, expected);
}

// ─── Sender-firm routing ───────────────────────────────────────────────────
// Maps a WhatsApp sender phone (E.164) to the firm + role + default agent.
// Backed by the existing `messaging_users` table (per src/lib/db-postgres.ts).
// Unknown senders return null; the caller decides whether to silently drop or
// bounce a "not enrolled" reply.

export interface RouteLookup {
  firmId: string;
  userId?: string;
  defaultAgentId?: string;
  displayName?: string;
}

export type SenderLookupFn = (phone: string) => Promise<RouteLookup | null>;

/**
 * Default lookup hits db-postgres. Tests pass a mock that doesn't touch the DB.
 * The platform = WhatsApp number (`gupshupSourceNumber`) is shared across all
 * firms, so routing is purely by sender phone.
 */
export async function defaultSenderLookup(phone: string): Promise<RouteLookup | null> {
  // Lazy import to keep the module pure when tests stub the lookup.
  const { sql } = await import("./db-postgres");
  if (!sql) return null;
  const rows = (await sql`
    SELECT company_id, default_agent_id, display_name
    FROM messaging_users
    WHERE platform = 'whatsapp'
      AND platform_user_id = ${phone}
    LIMIT 1
  `) as Array<{ company_id: string | null; default_agent_id: string | null; display_name: string | null }>;
  const row = rows[0];
  if (!row || !row.company_id) return null;
  return {
    firmId: row.company_id,
    defaultAgentId: row.default_agent_id ?? undefined,
    displayName: row.display_name ?? undefined,
  };
}

// ─── Gupshup client ────────────────────────────────────────────────────────

interface GupshupSendResult {
  messageId: string;
  status: string;
}

async function gupshupSend(
  cfg: WhatsAppConfig,
  destination: string,
  message: Record<string, unknown>
): Promise<GupshupSendResult> {
  if (!cfg.gupshupApiKey || !cfg.gupshupAppName || !cfg.gupshupSourceNumber) {
    // Dev mode: log + return a fake id so tests + local dev don't blow up.
    console.warn("[whatsapp] Gupshup creds missing; logging instead of sending.");
    return { messageId: `dev_${randomUUID()}`, status: "dev_logged" };
  }
  const body = new URLSearchParams({
    channel: "whatsapp",
    source: cfg.gupshupSourceNumber,
    destination,
    "src.name": cfg.gupshupAppName,
    message: JSON.stringify(message),
  });
  const res = await cfg.fetchImpl!(
    "https://api.gupshup.io/wa/api/v1/msg",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apikey: cfg.gupshupApiKey,
      },
      body: body.toString(),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gupshup send failed: HTTP ${res.status} — ${text}`);
  }
  const json = (await res.json()) as { messageId?: string; status?: string };
  return { messageId: json.messageId ?? "unknown", status: json.status ?? "submitted" };
}

// ─── WhatsAppHelper implementation ─────────────────────────────────────────

export interface WhatsAppHelperContext {
  /** Active firm. Used for HMAC payload + audit tracing. */
  firmId: string;
  /** Active agent. Used for HMAC payload + tracing. */
  agentId: string;
  /** Active agent run. Used for idempotency + audit. */
  runId: string;
}

/**
 * Build a WhatsAppHelper bound to the active agent run context.
 * Agent code calls helpers.whatsapp.sendApprovalCard(...); this builder is
 * called by the agent runtime when constructing AgentRunContext.helpers.
 */
export function buildWhatsAppHelper(
  ctx: WhatsAppHelperContext,
  configOverrides?: Partial<WhatsAppConfig>
): WhatsAppHelper {
  const cfg = getConfig(configOverrides);
  return {
    async sendApprovalCard(opts: ApprovalCardOptions): Promise<ApprovalCardResult> {
      if (!cfg.callbackSecret) {
        throw new Error("buildWhatsAppHelper.sendApprovalCard: WHATSAPP_CALLBACK_SECRET is required");
      }
      const cardId = `card_${randomUUID()}`;
      const expirySeconds = opts.expirySeconds ?? 7 * 24 * 3600;
      const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
      const approveUrl = signCallbackUrl(
        { cardId, firmId: ctx.firmId, agentId: ctx.agentId, runId: ctx.runId, action: "approve", expiry, data: opts.payload },
        cfg.callbackSecret,
        cfg.baseUrl!
      );
      const rejectUrl = signCallbackUrl(
        { cardId, firmId: ctx.firmId, agentId: ctx.agentId, runId: ctx.runId, action: "reject", expiry, data: opts.payload },
        cfg.callbackSecret,
        cfg.baseUrl!
      );
      // Gupshup interactive button message. WhatsApp Business API supports up to 3 buttons per message.
      const message = {
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "text", text: opts.title.slice(0, 60) },
          body: { text: opts.body.slice(0, 1024) },
          footer: { text: cardId },
          action: {
            buttons: [
              { type: "reply", reply: { id: `approve:${cardId}`, title: opts.buttons?.approve ?? "Approve" } },
              { type: "reply", reply: { id: `reject:${cardId}`, title: opts.buttons?.reject ?? "Reject" } },
            ],
          },
        },
        // Companion URLs in case the user prefers to click through (some clients).
        approveUrl,
        rejectUrl,
      };
      const result = await gupshupSend(cfg, opts.to, message);
      return { cardId, messageId: result.messageId };
    },

    async sendNotification(opts) {
      const message = opts.template
        ? {
            type: "template",
            template: {
              namespace: cfg.gupshupAppName,
              name: opts.template,
              language: { code: "en" },
              components: opts.templateParams
                ? [{ type: "body", parameters: opts.templateParams.map((t) => ({ type: "text", text: t })) }]
                : [],
            },
          }
        : { type: "text", text: opts.body };
      const result = await gupshupSend(cfg, opts.to, message);
      return { messageId: result.messageId };
    },
  };
}

// ─── Inbound message routing ───────────────────────────────────────────────
// The webhook handler (src/app/api/messaging/whatsapp/webhook/route.ts, future)
// calls this with the parsed Gupshup payload + signature already validated.

export interface InboundMessage {
  /** Sender phone in E.164. */
  from: string;
  /** Plain text content (or empty string for non-text messages). */
  text: string;
  /** Original Gupshup message id (for audit + de-dup). */
  messageId: string;
  /** Ms timestamp from the BSP. */
  timestamp: number;
  /** Optional interactive button payload, if the user clicked a button. */
  buttonReply?: { id: string; title: string };
  /** Original raw payload, for audit. */
  raw: unknown;
}

export interface RoutedMessage extends InboundMessage {
  firmId: string;
  agentId?: string;
  userId?: string;
  displayName?: string;
}

export async function routeInboundMessage(
  msg: InboundMessage,
  lookup: SenderLookupFn = defaultSenderLookup
): Promise<RoutedMessage | { unknownSender: true; from: string }> {
  const route = await lookup(msg.from);
  if (!route) {
    return { unknownSender: true, from: msg.from };
  }
  return {
    ...msg,
    firmId: route.firmId,
    agentId: route.defaultAgentId,
    userId: route.userId,
    displayName: route.displayName,
  };
}
