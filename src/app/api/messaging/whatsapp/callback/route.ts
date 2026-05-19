/**
 * WhatsApp approval-button callback handler.
 *
 * When the agent's WhatsAppHelper.sendApprovalCard sends a message, the URLs
 * embedded in the buttons all point here with `?p=<base64url payload>&s=<hex sig>`.
 *
 * Flow:
 *   1. Read p + s from query params.
 *   2. Verify HMAC against WHATSAPP_CALLBACK_SECRET.
 *   3. Reject if expired (CallbackPayload.expiry < now).
 *   4. Idempotency: insert into `approval_callbacks` keyed on cardId+action.
 *      If conflict, return the prior outcome unchanged.
 *   5. Execute the action: in v1 we just persist the decision; the agent's
 *      next run picks it up by reading `approval_callbacks`.
 *
 * Tests cover: signature validation, expiry, idempotency, and the
 * dispatch hook injection.
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { verifyCallbackUrl, type CallbackPayload } from "@/lib/whatsapp";

export interface RunCallbackDeps {
  callbackSecret?: string;
  /**
   * Persist the decision. Returns true if this was a new persistence,
   * false if the (cardId, action) was already recorded (idempotent).
   * Tests pass a mock; production wires to Postgres.
   */
  persist?: (payload: CallbackPayload) => Promise<{ created: boolean; id: string }>;
  /**
   * Optional side-effect hook invoked once per (cardId, action) — e.g.
   * notify the agent runtime that a waiting approval has resolved.
   */
  onResolved?: (payload: CallbackPayload) => Promise<void>;
}

async function defaultPersist(payload: CallbackPayload): Promise<{ created: boolean; id: string }> {
  const { sql } = await import("@/lib/db-postgres");
  if (!sql) {
    return { created: false, id: "no-db" };
  }
  // Use ON CONFLICT (card_id, action) DO NOTHING to make the insert idempotent.
  const id = `appcb_${randomUUID()}`;
  const rows = (await sql`
    INSERT INTO approval_callbacks (
      id, card_id, firm_id, agent_id, run_id, action, payload, expiry
    ) VALUES (
      ${id},
      ${payload.cardId},
      ${payload.firmId},
      ${payload.agentId},
      ${payload.runId},
      ${payload.action},
      ${JSON.stringify(payload.data)},
      to_timestamp(${payload.expiry})
    )
    ON CONFLICT (card_id, action) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;
  return { created: rows.length > 0, id: rows[0]?.id ?? id };
}

export async function runWhatsAppCallback(
  encodedParam: string | null,
  signatureParam: string | null,
  deps: RunCallbackDeps = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = deps.callbackSecret ?? process.env.WHATSAPP_CALLBACK_SECRET;
  if (!secret) {
    return { status: 503, body: { error: "Callback secret not configured" } };
  }
  if (!encodedParam || !signatureParam) {
    return { status: 400, body: { error: "Missing p or s query parameter" } };
  }
  const payload = verifyCallbackUrl(encodedParam, signatureParam, secret);
  if (!payload) {
    return { status: 401, body: { error: "Invalid or expired callback" } };
  }
  const persist = deps.persist ?? defaultPersist;
  const persistResult = await persist(payload);
  if (persistResult.created && deps.onResolved) {
    try {
      await deps.onResolved(payload);
    } catch (err) {
      console.warn("[whatsapp/callback] onResolved hook failed:", err);
    }
  }
  return {
    status: 200,
    body: {
      ok: true,
      cardId: payload.cardId,
      action: payload.action,
      idempotent: !persistResult.created,
    },
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const result = await runWhatsAppCallback(
    url.searchParams.get("p"),
    url.searchParams.get("s")
  );
  // Return a tiny HTML so the user gets a friendly confirmation in the browser
  // when they click the button URL.
  if (result.status === 200) {
    const action = (result.body as { action?: string }).action ?? "received";
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Recorded: ${action}</h2><p>You can close this tab.</p></body></html>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
  return NextResponse.json(result.body, { status: result.status });
}

// Some BSPs POST instead of GET when buttons are clicked through their proxy.
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const result = await runWhatsAppCallback(
    url.searchParams.get("p"),
    url.searchParams.get("s")
  );
  return NextResponse.json(result.body, { status: result.status });
}
