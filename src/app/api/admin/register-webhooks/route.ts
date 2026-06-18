/**
 * Register external webhooks against the current deployment.
 *
 * Today this only handles Telegram (Resend inbound is configured in the
 * Resend dashboard, not via API). Wire this into your deploy hook so
 * production self-registers — removes one Tier 1 you-action.
 *
 *   POST /api/admin/register-webhooks
 *   Header: x-internal-secret: $INTERNAL_SECRET  (or a Clerk session)
 *   Body:   { baseUrl?: string }   — defaults to APP_BASE_URL / NEXT_PUBLIC_APP_URL
 *
 * Response:
 *   { telegram: { registered: boolean, url?: string, info?: unknown, error?: string } }
 *
 * Idempotent: safe to call on every deploy. setWebhook overwrites the
 * existing registration.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  isTelegramConfigured,
  setWebhook,
  getWebhookInfo,
} from "@/lib/telegram";
import { safeEqual } from "@/lib/secure-compare";

export async function POST(request: NextRequest) {
  // Auth: either an internal secret (so a CI deploy hook can call this
  // without Clerk) or a signed-in Clerk session.
  const got = request.headers.get("x-internal-secret");
  const isInternal =
    !!got && !!process.env.INTERNAL_SECRET && safeEqual(got, process.env.INTERNAL_SECRET);
  if (!isInternal) {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as { baseUrl?: string };
  const baseUrl =
    body.baseUrl ??
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";

  if (!baseUrl) {
    return NextResponse.json(
      { error: "No baseUrl supplied and APP_BASE_URL / NEXT_PUBLIC_APP_URL unset" },
      { status: 400 }
    );
  }

  const result: {
    telegram: {
      registered: boolean;
      url?: string;
      info?: unknown;
      error?: string;
      skipped?: string;
    };
    baseUrl: string;
  } = {
    baseUrl,
    telegram: { registered: false },
  };

  if (!isTelegramConfigured()) {
    result.telegram.skipped = "TELEGRAM_BOT_TOKEN unset";
  } else {
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/messaging/telegram`;
    try {
      await setWebhook(webhookUrl);
      const info = await getWebhookInfo();
      result.telegram = { registered: true, url: webhookUrl, info };
    } catch (err) {
      result.telegram = {
        registered: false,
        url: webhookUrl,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json(result);
}

export async function GET() {
  // Lightweight diagnostic — returns the current webhook info without
  // touching anything. Useful from `curl` during deploy verification.
  if (!isTelegramConfigured()) {
    return NextResponse.json({ telegram: { skipped: "TELEGRAM_BOT_TOKEN unset" } });
  }
  try {
    const info = await getWebhookInfo();
    return NextResponse.json({ telegram: { info } });
  } catch (err) {
    return NextResponse.json({
      telegram: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
