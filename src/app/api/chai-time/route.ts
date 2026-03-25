import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCompaniesByUser,
  getChaiTimeConfig,
  updateChaiTimeConfig,
  getLatestChaiTimeSession,
  getChaiTimeSessions,
} from "@/lib/db";
import { runChaiTime } from "@/lib/chai-time";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId)
    return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const showSessions =
    request.nextUrl.searchParams.get("sessions") === "true";

  const config = await getChaiTimeConfig(companyId);

  if (showSessions) {
    const sessions = await getChaiTimeSessions(companyId, 7);
    return NextResponse.json({ config, sessions });
  }

  const latest = await getLatestChaiTimeSession(companyId);
  return NextResponse.json({ config, latest });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { companyId, action } = body;

  if (!companyId || !action)
    return NextResponse.json(
      { error: "companyId and action required" },
      { status: 400 }
    );

  const companies = await getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "run") {
    try {
      const result = await runChaiTime(companyId);
      return NextResponse.json({
        success: true,
        session: result.session,
        summaries: result.summaries,
        crossUpdates: result.crossUpdates,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: "Chai Time failed",
          detail: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  if (action === "configure") {
    const { hour, minute, timezone, enabled } = body;
    await updateChaiTimeConfig(companyId, {
      ...(hour !== undefined && { time_hour: Number(hour) }),
      ...(minute !== undefined && { time_minute: Number(minute) }),
      ...(timezone !== undefined && { timezone: String(timezone) }),
      ...(enabled !== undefined && { enabled: enabled ? 1 : 0 }),
    });
    const config = await getChaiTimeConfig(companyId);
    return NextResponse.json({ success: true, config });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
