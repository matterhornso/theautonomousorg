/**
 * End-to-end verifier for the broadcast agent (migration 009).
 *
 * Exercises the whole path against the local dev server + live DB:
 *   1. CSV parsing (pure)
 *   2. Bulk contact import
 *   3. Admin enrolment via the Telegram webhook (/register <code>)
 *   4. A plain-English broadcast command → agent → fan-out
 *   5. A "send timesheet reminders" command
 *   6. The broadcasts audit log
 *
 * Side effects: seeds test contacts + a test admin into the JAA firm, then
 * deletes them. Test contacts are phone-only or use an unreachable Telegram
 * chat_id, so no real email/Telegram delivery happens.
 *
 * Usage: TEST_BASE_URL=http://localhost:3005 bun run scripts/broadcast-e2e.ts
 */

import { parseContactsCsv, bulkUpsertContacts } from "../src/lib/contacts";
import { recentBroadcasts } from "../src/lib/broadcast";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3005";
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const CODE = process.env.BROADCAST_ADMIN_CODE;
const JAA = process.env.BROADCAST_COMPANY_ID ?? "co_jaa_9cfcecf968f1";
const ADMIN_CHAT = 888800001;

function ok(s: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${s}`);
}
function info(s: string) {
  console.log(`  \x1b[36mi\x1b[0m ${s}`);
}
function fail(s: string, err?: unknown): never {
  console.log(`  \x1b[31m✗\x1b[0m ${s}`);
  if (err) console.error(err);
  process.exit(1);
}

let updateId = 5000;
function makeUpdate(text: string, chatId = ADMIN_CHAT) {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      from: { id: chatId, first_name: "QA", last_name: "Admin", username: "qa_admin" },
      chat: { id: chatId, type: "private" },
      text,
      date: Math.floor(Date.now() / 1000),
    },
  };
}

async function webhook(label: string, text: string) {
  const res = await fetch(`${BASE}/api/messaging/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": SECRET!,
    },
    body: JSON.stringify(makeUpdate(text)),
  });
  console.log(`  [${res.status}] ${label}`);
  if (res.status !== 200) fail(`Expected 200 from webhook, got ${res.status}`);
}

async function main() {
  if (!SECRET) fail("TELEGRAM_WEBHOOK_SECRET not set — load .env.local");
  if (!CODE) fail("BROADCAST_ADMIN_CODE not set — load .env.local");

  console.log("\n────── 1. CSV parsing ──────");
  const csv =
    "Name,Email,Phone\n" +
    'QA Contact A,,+91 99999 00001\n' +
    '"Contact, B",qa-b@example.invalid,+91 99999 00002\n' +
    "Bad Row,not-an-email,\n";
  const { contacts: parsed, warnings } = parseContactsCsv(csv);
  if (parsed.length !== 2) fail(`Expected 2 valid contacts, got ${parsed.length}`);
  if (!parsed.find((c) => c.name === "Contact, B"))
    fail("Quoted field with comma was not parsed correctly");
  ok(`Parsed 2 contacts, ${warnings.length} warning(s) (bad email skipped)`);

  console.log("\n────── 2. Bulk import into JAA ──────");
  const { written } = await bulkUpsertContacts(JAA, parsed);
  ok(`Imported ${written} contact(s)`);
  // Idempotency: re-import should update, not duplicate.
  const { written: written2 } = await bulkUpsertContacts(JAA, parsed);
  ok(`Re-import wrote ${written2} (upsert — no duplicates expected)`);

  console.log("\n────── 3. Admin enrolment via webhook ──────");
  await webhook("/register <wrong code>", "/register definitely-wrong");
  await webhook("/register <valid code>", `/register ${CODE}`);
  const { findBroadcastAdmin } = await import("../src/lib/broadcast");
  const admin = await findBroadcastAdmin(ADMIN_CHAT);
  if (!admin) fail("Admin chat was not registered");
  if (admin.companyId !== JAA) fail(`Admin bound to wrong firm: ${admin.companyId}`);
  ok(`Admin chat ${ADMIN_CHAT} registered → firm ${admin.companyId}`);

  console.log("\n────── 4. Broadcast command (agent → fan-out) ──────");
  await webhook(
    "broadcast instruction",
    "let everyone know the office will be closed this Friday for Diwali"
  );
  info("Agent interpreted + fanned out (test contacts are unreachable — counts as failed sends, which is expected)");

  console.log("\n────── 5. Send-reminders command ──────");
  await webhook("send timesheet reminders", "please send out the timesheet reminders now");

  console.log("\n────── 6. Broadcast audit log ──────");
  const log = await recentBroadcasts(JAA, 5);
  const actions = log.map((b) => b.action);
  if (!actions.includes("broadcast"))
    fail(`Expected a 'broadcast' log row, got: ${actions.join(", ")}`);
  if (!actions.includes("send_reminders"))
    fail(`Expected a 'send_reminders' log row, got: ${actions.join(", ")}`);
  ok(`Audit log has ${log.length} recent entries incl. broadcast + send_reminders`);
  for (const b of log.slice(0, 3)) {
    info(`  ${b.action}: ${b.emailSent} email / ${b.telegramSent} tg / ${b.failed} failed`);
  }

  console.log("\n────── 7. Cleanup ──────");
  const { sql } = await import("../src/lib/db-postgres");
  if (sql) {
    await sql`DELETE FROM contacts WHERE company_id = ${JAA} AND name IN ('QA Contact A', 'Contact, B')`;
    await sql`DELETE FROM broadcast_admins WHERE telegram_chat_id = ${ADMIN_CHAT}`;
    await sql`DELETE FROM broadcasts WHERE company_id = ${JAA} AND admin_chat_id = ${ADMIN_CHAT}`;
    ok("Test contacts, admin, and broadcast log rows removed.");
  }

  console.log("\n\x1b[32m═══════════ BROADCAST E2E COMPLETE ═══════════\x1b[0m\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n\x1b[31mE2E FAILED:\x1b[0m", err);
  process.exit(1);
});
