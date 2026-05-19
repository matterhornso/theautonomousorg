/**
 * POST /api/calendar/ingest
 *
 * Body:
 *   { events: Array<{ title, startsAt, endsAt?, attendees?, source?, sourceRef?, metadata? }> }
 *   — OR —
 *   { title, startsAt, ... }  // single event shorthand
 *
 * Writes events into events_log. Idempotent on (companyId, source, sourceRef):
 * pushing the same calendar event multiple times updates in place rather
 * than creating duplicates. Drives the pre-meeting brief cron.
 *
 * Auth: Clerk session OR x-internal-secret. Internal calls supply
 * companyId in the body; Clerk calls infer it from the active tenant.
 *
 * Supported sources today: any string ('google_calendar', 'outlook',
 * 'fireflies', 'manual'). The cron doesn't care which source — it just
 * scans events_log for upcoming starts_at.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import { createEventLog } from "@/lib/knowledge-graph";

interface RawEvent {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  attendees?: unknown[];
  source?: string;
  sourceRef?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const isInternal =
    internalSecret &&
    process.env.INTERNAL_SECRET &&
    internalSecret === process.env.INTERNAL_SECRET;

  let body: { events?: RawEvent[]; companyId?: string } & RawEvent;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Resolve tenant
  let companyId: string;
  if (isInternal) {
    if (!body.companyId) {
      return NextResponse.json(
        { error: "companyId required for internal calls" },
        { status: 400 }
      );
    }
    companyId = body.companyId;
  } else {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenant = await resolveTenant();
    companyId = tenant.firm.id;
  }

  // Normalize to a list of events
  const raw: RawEvent[] = Array.isArray(body.events)
    ? body.events
    : body.title
      ? [body]
      : [];
  if (raw.length === 0) {
    return NextResponse.json(
      { error: "at least one event required (events: [...] or title+startsAt)" },
      { status: 400 }
    );
  }

  const created: string[] = [];
  const skipped: Array<{ index: number; reason: string }> = [];
  for (let i = 0; i < raw.length; i++) {
    const e = raw[i];
    if (!e.title || !e.startsAt) {
      skipped.push({ index: i, reason: "missing title or startsAt" });
      continue;
    }
    const startsAt = new Date(e.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      skipped.push({ index: i, reason: "invalid startsAt" });
      continue;
    }
    const endsAt = e.endsAt ? new Date(e.endsAt) : undefined;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      skipped.push({ index: i, reason: "invalid endsAt" });
      continue;
    }
    try {
      const row = await createEventLog({
        companyId,
        title: e.title,
        startsAt,
        endsAt,
        attendees: e.attendees,
        source: e.source,
        sourceRef: e.sourceRef,
        metadata: e.metadata,
      });
      if (row) created.push(row.id);
      else skipped.push({ index: i, reason: "DATABASE_URL not configured" });
    } catch (err) {
      skipped.push({
        index: i,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ingested: created.length,
    skipped,
    eventIds: created,
  });
}
