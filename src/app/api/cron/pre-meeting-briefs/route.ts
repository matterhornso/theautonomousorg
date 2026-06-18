/**
 * GET /api/cron/pre-meeting-briefs
 *   Authorization: Bearer $CRON_SECRET   (or x-cron-secret: $CRON_SECRET)
 * (POST also accepted with x-internal-secret header)
 *
 * Scans events_log across all tenants for meetings starting within the
 * brief-delivery window (default: 25-35 min from now), generates a
 * pre-meeting brief via /api/memory/brief's generator, and emails it to
 * the first attendee.
 *
 * Idempotent: each event gets a metadata.brief_sent_at stamp after
 * delivery. Subsequent cron runs skip events that already have it.
 *
 * Schedule recommendation: every 5 minutes via Railway / Vercel Cron.
 *
 * Tuneable via query params:
 *   - lookAheadMin   default 30   (target time-to-event in minutes)
 *   - windowMin      default 10   (± window around lookAheadMin)
 *   - maxEvents      default 50   (cap per run to bound LLM spend)
 *   - dryRun=1                    (compute briefs but do not email or stamp)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getEventsAcrossTenantsBetween,
  updateEventMetadata,
  type EventLogEntry,
} from "@/lib/knowledge-graph";
import { generateBrief } from "@/lib/brief";
import { sendEmail } from "@/lib/email";
import { safeEqual } from "@/lib/secure-compare";

function isAuthorized(req: NextRequest): boolean {
  // Cron secret is header-only — never accepted via query string (query
  // strings leak into access logs, proxies, and browser history).
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const cronHeader = bearer ?? req.headers.get("x-cron-secret");
  if (
    cronHeader &&
    process.env.CRON_SECRET &&
    safeEqual(cronHeader, process.env.CRON_SECRET)
  ) {
    return true;
  }
  const header = req.headers.get("x-internal-secret");
  if (
    header &&
    process.env.INTERNAL_SECRET &&
    safeEqual(header, process.env.INTERNAL_SECRET)
  ) {
    return true;
  }
  return false;
}

function paramInt(req: NextRequest, key: string, fallback: number): number {
  const raw = req.nextUrl.searchParams.get(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function attendeeEmails(event: EventLogEntry): string[] {
  // Accept various shapes — string[], { email, name }[], or { address }[].
  const out: string[] = [];
  for (const a of event.attendees) {
    if (typeof a === "string" && a.includes("@")) {
      out.push(a);
    } else if (a && typeof a === "object") {
      const obj = a as Record<string, unknown>;
      if (typeof obj.email === "string") out.push(obj.email);
      else if (typeof obj.address === "string") out.push(obj.address);
    }
  }
  return out;
}

function attendeeNames(event: EventLogEntry): string[] {
  const out: string[] = [];
  for (const a of event.attendees) {
    if (typeof a === "string") out.push(a);
    else if (a && typeof a === "object") {
      const obj = a as Record<string, unknown>;
      if (typeof obj.name === "string") out.push(obj.name);
      else if (typeof obj.email === "string") out.push(obj.email);
    }
  }
  return out;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lookAheadMin = paramInt(req, "lookAheadMin", 30);
  const windowMin = paramInt(req, "windowMin", 10);
  const maxEvents = paramInt(req, "maxEvents", 50);
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const now = Date.now();
  const from = new Date(now + (lookAheadMin - windowMin) * 60_000);
  const to = new Date(now + (lookAheadMin + windowMin) * 60_000);

  const events = await getEventsAcrossTenantsBetween(from, to, maxEvents);

  const result: {
    scanned: number;
    eligible: number;
    delivered: number;
    skipped: Array<{ eventId: string; reason: string }>;
    deliveries: Array<{
      eventId: string;
      companyId: string;
      title: string;
      to: string;
      llmRan: boolean;
    }>;
    dryRun: boolean;
    window: { from: string; to: string };
  } = {
    scanned: events.length,
    eligible: 0,
    delivered: 0,
    skipped: [],
    deliveries: [],
    dryRun,
    window: { from: from.toISOString(), to: to.toISOString() },
  };

  for (const event of events) {
    const meta = event.metadata as Record<string, unknown>;
    if (meta.brief_sent_at) {
      result.skipped.push({
        eventId: event.id,
        reason: "brief_sent_at already set",
      });
      continue;
    }
    const emails = attendeeEmails(event);
    if (emails.length === 0) {
      result.skipped.push({
        eventId: event.id,
        reason: "no attendee emails",
      });
      continue;
    }
    result.eligible++;

    let brief;
    try {
      brief = await generateBrief({
        companyId: event.companyId,
        eventTitle: event.title,
        attendees: attendeeNames(event),
        occurredAt: event.startsAt,
      });
    } catch (err) {
      result.skipped.push({
        eventId: event.id,
        reason: `generateBrief failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    if (dryRun) {
      result.deliveries.push({
        eventId: event.id,
        companyId: event.companyId,
        title: event.title,
        to: emails[0],
        llmRan: brief.llmRan,
      });
      continue;
    }

    const sent = await sendEmail({
      to: emails[0],
      subject: `Pre-meeting brief: ${event.title}`,
      body: brief.markdown,
    });

    if (!sent.sent) {
      result.skipped.push({
        eventId: event.id,
        reason: `email send failed: ${sent.reason ?? "unknown"}`,
      });
      continue;
    }

    // Stamp the event so future cron runs skip it.
    await updateEventMetadata(event.id, {
      brief_sent_at: new Date().toISOString(),
      brief_sent_to: emails[0],
      brief_llm_ran: brief.llmRan,
    });

    result.delivered++;
    result.deliveries.push({
      eventId: event.id,
      companyId: event.companyId,
      title: event.title,
      to: emails[0],
      llmRan: brief.llmRan,
    });
  }

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return run(request);
}
export async function POST(request: NextRequest) {
  return run(request);
}
