/**
 * POST /api/memory/brief
 *
 * Body: {
 *   eventTitle: string,
 *   attendees: string[],
 *   occurredAt?: string,    // ISO datetime
 *   companyId?: string,     // required when called with x-internal-secret
 * }
 *
 * Returns: {
 *   markdown: string,
 *   sources: { commitmentIds: string[], conversationIds: string[], decisionIds: string[] },
 *   llmRan: boolean
 * }
 *
 * Auth: Clerk session OR x-internal-secret (so the pre-meeting brief cron
 * can call this without a Clerk cookie).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import { generateBrief } from "@/lib/brief";
import { safeEqual } from "@/lib/secure-compare";

export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const isInternal =
    !!internalSecret &&
    !!process.env.INTERNAL_SECRET &&
    safeEqual(internalSecret, process.env.INTERNAL_SECRET);

  let body: {
    eventTitle?: string;
    attendees?: string[];
    occurredAt?: string;
    companyId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.eventTitle || typeof body.eventTitle !== "string") {
    return NextResponse.json(
      { error: "eventTitle is required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.attendees)) {
    return NextResponse.json(
      { error: "attendees must be an array of strings" },
      { status: 400 }
    );
  }

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

  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : undefined;
  if (occurredAt && Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json(
      { error: "occurredAt must be an ISO datetime" },
      { status: 400 }
    );
  }

  try {
    const result = await generateBrief({
      companyId,
      eventTitle: body.eventTitle,
      attendees: body.attendees.filter((a): a is string => typeof a === "string"),
      occurredAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
