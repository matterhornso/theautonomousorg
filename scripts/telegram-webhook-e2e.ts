/**
 * Simulates inbound Telegram updates against the local /api/messaging/telegram
 * route. Tests the full keyword-handling path:
 *   - /link <email>           → bind chat_id
 *   - DONE                    → mark submission submitted
 *   - HELP                    → escalate (acknowledged)
 *   - /start (linked)         → personalised welcome
 *   - /start (unlinked)       → onboarding hint
 *   - unknown chat            → "link your account" hint
 *
 * Bypasses Clerk because the route is webhook-gated by TELEGRAM_WEBHOOK_SECRET,
 * not by user session. We construct realistic Telegram Update payloads.
 *
 * Side effects: bot will TRY to send replies via the live Telegram API. If the
 * test chat_id (TEST_CHAT_ID below) doesn't exist, sends will fail silently
 * (the route swallows send errors and still returns 200). DB state is mutated:
 *   - Girish's chat_id is set, then DONE is processed, then state is reset.
 *
 * Usage: bun run scripts/telegram-webhook-e2e.ts
 */

import { createHash } from "crypto";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3007";
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Use a chat_id that we know is unlikely to be a real Telegram chat. Sends
// will fail server-side but the webhook handler will still complete its DB
// work. To do a true end-to-end with real message delivery, set TEST_CHAT_ID
// to your own Telegram chat_id (look it up via @userinfobot).
const TEST_CHAT_ID = Number(process.env.TEST_CHAT_ID ?? "999999000001");

if (!SECRET) {
  console.error("TELEGRAM_WEBHOOK_SECRET not set — load .env.local first.");
  process.exit(1);
}

let updateId = 1;
function makeUpdate(text: string, chatId = TEST_CHAT_ID, username = "test_user") {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      from: {
        id: chatId,
        first_name: "Test",
        last_name: "User",
        username,
      },
      chat: { id: chatId, type: "private" },
      text,
      date: Math.floor(Date.now() / 1000),
    },
  };
}

async function send(label: string, body: object) {
  const res = await fetch(`${BASE}/api/messaging/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": SECRET!,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log(`  [${res.status}] ${label}: ${JSON.stringify(json).slice(0, 120)}`);
  return { status: res.status, json };
}

async function fail(msg: string): Promise<never> {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

async function main() {
  console.log("\n────── Webhook auth ──────");
  // Wrong secret should be rejected.
  const bad = await fetch(`${BASE}/api/messaging/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": "wrong-secret",
    },
    body: JSON.stringify(makeUpdate("/start")),
  });
  if (bad.status !== 401) await fail(`Expected 401 with wrong secret, got ${bad.status}`);
  console.log(`  \x1b[32m✓\x1b[0m wrong secret → 401`);

  console.log("\n────── /start from unlinked chat ──────");
  await send("/start (unlinked)", makeUpdate("/start"));

  console.log("\n────── /link with bad email ──────");
  await send("/link unknown@x.com", makeUpdate("/link unknown@nowhere.example"));

  console.log("\n────── /link Girish — should bind chat_id ──────");
  await send(
    "/link girish@jaa-associates.com",
    makeUpdate("/link girish@jaa-associates.com")
  );

  console.log("\n────── Verify Girish now linked in DB ──────");
  const { findEmployeeByTelegramChatId } = await import(
    "../src/lib/timesheets"
  );
  const linked = await findEmployeeByTelegramChatId(TEST_CHAT_ID);
  if (!linked) await fail("Girish was not linked to test chat_id");
  if (linked.email !== "girish@jaa-associates.com")
    await fail(
      `Wrong employee linked: ${linked.email} (expected girish@jaa-associates.com)`
    );
  console.log(`  \x1b[32m✓\x1b[0m Girish chat_id now ${linked.telegramChatId}`);

  console.log("\n────── /start from linked chat (personalised welcome) ──────");
  await send("/start (linked)", makeUpdate("/start"));

  console.log("\n────── DONE keyword — should mark submitted ──────");
  await send("DONE", makeUpdate("DONE"));

  console.log("\n────── Verify submission flipped in DB ──────");
  const {
    currentPeriodKey,
    getActiveSubmissionForEmployee,
  } = await import("../src/lib/timesheets");
  const sub = await getActiveSubmissionForEmployee(linked.id, currentPeriodKey());
  if (!sub) await fail("No submission row for current period");
  if (!sub.submittedAt)
    await fail("Submission not marked as submitted after DONE keyword");
  if (sub.source !== "telegram")
    await fail(`Expected source='telegram', got ${sub.source}`);
  console.log(
    `  \x1b[32m✓\x1b[0m Submission marked at ${sub.submittedAt.toISOString()} via ${sub.source}`
  );

  console.log("\n────── DONE again (idempotent — already submitted) ──────");
  await send("DONE (idempotent)", makeUpdate("DONE"));

  console.log("\n────── HELP keyword — should ack escalation ──────");
  await send("HELP", makeUpdate("HELP"));

  console.log("\n────── Cleanup: reset Girish chat_id + submission ──────");
  const { sql } = await import("../src/lib/db-postgres");
  if (sql) {
    await sql`UPDATE employees SET telegram_chat_id = NULL WHERE id = ${linked.id}`;
    await sql`UPDATE timesheet_submissions
              SET submitted_at = NULL, source = NULL
              WHERE employee_id = ${linked.id} AND period_key = ${currentPeriodKey()}`;
    console.log("  \x1b[32m✓\x1b[0m Girish reset to unlinked / outstanding for demo.");
  }

  console.log("\n\x1b[32m═══════════ TELEGRAM WEBHOOK E2E COMPLETE ═══════════\x1b[0m\n");
}

main().catch((err) => {
  console.error("\n\x1b[31mFAIL:\x1b[0m", err);
  process.exit(1);
});
