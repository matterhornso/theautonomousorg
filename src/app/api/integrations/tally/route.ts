/**
 * Tally on-prem agent ingestion endpoint (W3).
 *
 * The Windows .NET service running inside a CA firm's office network polls
 * Tally XML and POSTs payloads here. Per locked decision 1B-B:
 *   - Read-only by default (writes to Tally require an additional SPOC-signed
 *     request, not handled by this endpoint).
 *   - mTLS authentication: the load balancer terminates mTLS and forwards the
 *     client cert thumbprint in `X-Client-Cert-Fingerprint`. Until edge mTLS
 *     is provisioned we accept a shared bearer token in `Authorization` AND
 *     a per-firm header `X-Firm-Id` whose mapping lives in the
 *     `tally_agent_certs` table.
 *
 * Payload schema:
 *   {
 *     firmId: "firm_a",
 *     ledgerEntries?: [...],
 *     bankStatementRows?: [...],
 *     vouchers?: [...],
 *     ts: <unix epoch>
 *   }
 *
 * On accept:
 *   - Persist into `tally_inbox` (raw payload, awaiting agent processing)
 *   - Return 202 with the inbox id so the on-prem agent can de-dup retries
 *
 * Failures (cert mismatch, unknown firm, malformed body) all return without
 * persisting. We do NOT 200-OK invalid payloads — the on-prem agent retries
 * with backoff, so we want it to know.
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID, createHash } from "crypto";
import { z } from "zod";
import { safeEqual } from "@/lib/secure-compare";

const ledgerEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  narration: z.string(),
  ledgerName: z.string().optional(),
});

const payloadSchema = z.object({
  firmId: z.string().min(1),
  ts: z.number().int(),
  ledgerEntries: z.array(ledgerEntrySchema).optional(),
  bankStatementRows: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        amount: z.number(),
        narration: z.string(),
      })
    )
    .optional(),
  vouchers: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type TallyPayload = z.infer<typeof payloadSchema>;

export interface TallyDeps {
  /**
   * Resolve a (firmId, certFingerprint) pair against the tally_agent_certs
   * registry. Returns true if the fingerprint is on the firm's allowlist.
   * Tests pass a mock; production hits the DB.
   */
  verifyClient?: (firmId: string, certFingerprint: string) => Promise<boolean>;
  /**
   * Persist the validated payload to `tally_inbox`. Returns the inbox id.
   */
  persistInbox?: (firmId: string, payload: TallyPayload, payloadHash: string) => Promise<string>;
  /** Optional dispatcher: notifies the agent runtime of new Tally data. */
  notifyAgents?: (firmId: string, inboxId: string) => Promise<void>;
}

async function defaultVerifyClient(firmId: string, fingerprint: string): Promise<boolean> {
  const { sql } = await import("@/lib/db-postgres");
  if (!sql) return false;
  const rows = (await sql`
    SELECT 1 FROM tally_agent_certs
    WHERE firm_id = ${firmId}
      AND cert_fingerprint = ${fingerprint}
      AND revoked_at IS NULL
    LIMIT 1
  `) as Array<{ "?column?": number }>;
  return rows.length > 0;
}

async function defaultPersistInbox(
  firmId: string,
  payload: TallyPayload,
  payloadHash: string
): Promise<string> {
  const { sql } = await import("@/lib/db-postgres");
  if (!sql) throw new Error("tally: DATABASE_URL not configured");
  const id = `tinbox_${randomUUID()}`;
  // ON CONFLICT ON (firm_id, payload_hash) DO NOTHING gives us natural retry
  // safety: the on-prem agent's backoff loop won't double-write.
  const rows = (await sql`
    INSERT INTO tally_inbox (id, firm_id, payload, payload_hash, source_ts)
    VALUES (
      ${id},
      ${firmId},
      ${JSON.stringify(payload)},
      ${payloadHash},
      to_timestamp(${payload.ts})
    )
    ON CONFLICT (firm_id, payload_hash) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;
  return rows[0]?.id ?? id;
}

export async function runTallyIngest(
  rawBody: string,
  headers: Headers,
  deps: TallyDeps = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const expectedToken = process.env.TALLY_INGEST_TOKEN;
  const auth = headers.get("authorization");
  if (!expectedToken) {
    return { status: 503, body: { error: "Tally ingest token not configured" } };
  }
  const presented = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : auth;
  if (!safeEqual(presented, expectedToken)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const fingerprint = headers.get("x-client-cert-fingerprint") ?? "";
  if (!fingerprint) {
    return { status: 401, body: { error: "Missing X-Client-Cert-Fingerprint" } };
  }

  let payload: TallyPayload;
  try {
    const parsed = JSON.parse(rawBody);
    const result = payloadSchema.safeParse(parsed);
    if (!result.success) {
      return {
        status: 400,
        body: { error: "Schema validation failed", issues: result.error.issues },
      };
    }
    payload = result.data;
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }

  const verifyClient = deps.verifyClient ?? defaultVerifyClient;
  const ok = await verifyClient(payload.firmId, fingerprint);
  if (!ok) {
    return { status: 403, body: { error: "Cert not registered for firm" } };
  }

  const persist = deps.persistInbox ?? defaultPersistInbox;
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const inboxId = await persist(payload.firmId, payload, payloadHash);
  if (deps.notifyAgents) {
    try {
      await deps.notifyAgents(payload.firmId, inboxId);
    } catch (err) {
      console.warn("[tally] notifyAgents failed:", err);
    }
  }
  return { status: 202, body: { accepted: true, inboxId } };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const result = await runTallyIngest(rawBody, request.headers);
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "tally-ingest" });
}
