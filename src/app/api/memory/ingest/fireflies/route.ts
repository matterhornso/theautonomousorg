/**
 * POST /api/memory/ingest/fireflies
 *
 * Pulls meeting transcripts from Fireflies.ai and feeds each through the
 * existing entity-extraction pipeline (`ingestConversation`), landing them in
 * the one company brain. Transcripts already imported (matched on
 * `conversations.source_ref`) are skipped, so re-running is idempotent.
 *
 * Body: {
 *   limit?: number,          // transcripts to pull this call (default 8, hard cap 8 — see MAX_SYNC_IMPORT)
 *   skip?: number,           // pagination offset — use `nextSkip` from the prior response
 *   fromDate?: string,       // ISO date — only meetings on/after
 *   toDate?: string,         // ISO date — only meetings on/before
 *   visibility?: 'company' | 'private',  // default 'company' (shared brain)
 *   companyId?: string,      // internal calls only
 *   ownerUserId?: string,    // internal calls only, required if private
 * }
 *
 * Returns: {
 *   pulled, imported, skipped, errored,
 *   capped: boolean,         // true if a full batch came back — more may remain
 *   nextSkip: number,        // skip value to pass on the next call to continue
 *   results: Array<{ firefliesId, title, conversationId?, entityCount?, status, error? }>
 * }
 *
 * Each transcript runs a Claude extraction, so one call imports at most
 * MAX_SYNC_IMPORT (8). Paginate with `nextSkip` to pull more; import is
 * idempotent (deduped on conversations.source_ref), so re-runs are safe.
 *
 * Auth: Clerk session OR x-internal-secret (so a scheduled importer can run
 * without a Clerk cookie). The Fireflies API key is a global env var
 * (FIREFLIES_API_KEY) — single-tenant v1, per CLAUDE.md. Move to a per-firm
 * `integrations` row when onboarding a second firm.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import { ingestConversation } from "@/lib/entity-extractor";
import { existingConversationSourceRefs } from "@/lib/knowledge-graph";
import {
  getFirefliesClient,
  transcriptToText,
  type FirefliesTranscript,
} from "@/lib/fireflies";
import { safeSecretEqual } from "@/lib/request-guards";

const SOURCE = "fireflies";

// Each transcript triggers a Claude extraction; keep the synchronous batch small
// so the request finishes inside the function time budget. Callers paginate with
// `skip` (or re-run — import is idempotent) to pull more. See the `capped` flag
// in the response. A queue is the longer-term path (UNIFICATION.md risk table).
const MAX_SYNC_IMPORT = 8;

// Allow longer than the platform default — transcription + extraction is slow.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const client = getFirefliesClient();
  if (!client) {
    return NextResponse.json(
      { error: "Fireflies is not configured (FIREFLIES_API_KEY unset)." },
      { status: 503 }
    );
  }

  const internalSecret = request.headers.get("x-internal-secret");
  const isInternal = safeSecretEqual(internalSecret, process.env.INTERNAL_SECRET);

  let body: {
    limit?: number;
    skip?: number;
    fromDate?: string;
    toDate?: string;
    visibility?: string;
    companyId?: string;
    ownerUserId?: string;
  } = {};
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Resolve tenant + acting user (mirrors /api/memory/ingest).
  let companyId: string;
  let actingUserId: string | undefined;
  if (isInternal) {
    if (!body.companyId) {
      return NextResponse.json(
        { error: "companyId required for internal calls" },
        { status: 400 }
      );
    }
    companyId = body.companyId;
    actingUserId = body.ownerUserId;
  } else {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    actingUserId = session.userId;
    const tenant = await resolveTenant();
    companyId = tenant.firm.id;
  }

  const visibility: "company" | "private" =
    body.visibility === "private" ? "private" : "company";
  if (visibility === "private" && !actingUserId) {
    return NextResponse.json(
      { error: "ownerUserId required for a private import" },
      { status: 400 }
    );
  }

  // NaN-safe: a non-numeric `limit` falls back to the default rather than
  // poisoning the GraphQL query. Hard cap at MAX_SYNC_IMPORT so one request
  // never fans out into an unbounded run of LLM extractions.
  const requested = Number(body.limit);
  const limit = Math.min(
    Math.max(Number.isFinite(requested) ? Math.floor(requested) : MAX_SYNC_IMPORT, 1),
    MAX_SYNC_IMPORT
  );

  // 1. Pull transcripts from Fireflies.
  let transcripts: FirefliesTranscript[];
  try {
    transcripts = await client.listTranscripts({
      limit,
      skip: body.skip ?? 0,
      fromDate: body.fromDate,
      toDate: body.toDate,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch Fireflies transcripts",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  // 2. Skip transcripts already imported (idempotency on source_ref).
  const alreadyImported = await existingConversationSourceRefs(
    companyId,
    SOURCE,
    transcripts.map((t) => t.id)
  );

  const results: Array<{
    firefliesId: string;
    title: string;
    conversationId?: string;
    entityCount?: number;
    status: "imported" | "skipped" | "error";
    error?: string;
  }> = [];
  let imported = 0;
  let skipped = 0;
  let errored = 0;

  // 3. Feed each new transcript through the existing extractor.
  for (const t of transcripts) {
    if (alreadyImported.has(t.id)) {
      skipped += 1;
      results.push({ firefliesId: t.id, title: t.title, status: "skipped" });
      continue;
    }

    const text = transcriptToText(t.sentences);
    if (!text.trim()) {
      skipped += 1;
      results.push({
        firefliesId: t.id,
        title: t.title,
        status: "skipped",
        error: "empty transcript",
      });
      continue;
    }

    // Fireflies `date` is epoch milliseconds (number) or ISO string.
    const occurredAt = (() => {
      const d = new Date(
        typeof t.date === "number" ? t.date : Date.parse(t.date)
      );
      return Number.isNaN(d.getTime()) ? undefined : d;
    })();

    try {
      const result = await ingestConversation({
        companyId,
        text,
        kind: "meeting",
        title: t.title || "Fireflies meeting",
        occurredAt,
        source: SOURCE,
        sourceRef: t.id,
        metadata: {
          firefliesId: t.id,
          transcriptUrl: t.transcript_url ?? null,
          durationSeconds: t.duration ?? null,
        },
        visibility,
        ownerUserId: visibility === "private" ? actingUserId : undefined,
      });
      imported += 1;
      results.push({
        firefliesId: t.id,
        title: t.title,
        conversationId: result.conversation?.id,
        entityCount:
          result.personIds.length +
          result.decisionIds.length +
          result.commitmentIds.length,
        status: "imported",
      });
    } catch (err) {
      errored += 1;
      results.push({
        firefliesId: t.id,
        title: t.title,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    pulled: transcripts.length,
    imported,
    skipped,
    errored,
    // We pulled a full batch → there may be more. Caller should re-run with
    // `skip = skip + limit` (import is idempotent) to continue.
    capped: transcripts.length === limit,
    nextSkip: (body.skip ?? 0) + limit,
    results,
  });
}
