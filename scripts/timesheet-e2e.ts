/**
 * Live end-to-end demo verifier for the Telegram timesheet vertical.
 *
 * Steps:
 *   1. Confirm Telegram bot token works (getMe)
 *   2. Confirm DB has JAA Associates + Girish + period row
 *   3. Run the reminder pass — should report ok=false / "not linked"
 *      because Girish hasn't run /link yet
 *   4. Simulate a /link by manually setting Girish's chat_id to a known
 *      test chat (the one running the e2e — supplied via env)
 *   5. Run the reminder pass again — should send a real Telegram message
 *      OR fail gracefully if TELEGRAM_E2E_CHAT_ID isn't set
 *   6. Reset Girish's chat_id back to NULL so demo state is clean
 *
 * Usage:
 *   bun run scripts/timesheet-e2e.ts          # dry mode (no real send)
 *   TELEGRAM_E2E_CHAT_ID=123456 bun run …     # real-send mode
 */

import {
  currentPeriodKey,
  listEmployees,
  listOutstanding,
  runReminderPass,
  linkTelegramChatId,
} from "../src/lib/timesheets";

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

const JAA_ID = "co_jaa_9cfcecf968f1";

async function main() {
  console.log("\n────── 1. Telegram bot reachability ──────");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) fail("TELEGRAM_BOT_TOKEN missing in env");
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const meJson = (await meRes.json()) as { ok: boolean; result?: { username: string } };
  if (!meJson.ok) fail("getMe failed");
  ok(`Bot live: @${meJson.result!.username}`);

  console.log("\n────── 2. Roster check ──────");
  const period = currentPeriodKey();
  ok(`Period key: ${period}`);
  const employees = await listEmployees(JAA_ID);
  if (employees.length === 0) fail("No employees on JAA Associates roster");
  ok(`${employees.length} employee(s): ${employees.map((e) => e.name).join(", ")}`);
  const girish = employees.find((e) => e.email === "girish@jaa-associates.com");
  if (!girish) fail("Girish not in roster");
  ok(`Girish ID: ${girish.id} · chat_id: ${girish.telegramChatId ?? "<not linked>"}`);

  console.log("\n────── 3. Outstanding submissions ──────");
  const outstanding = await listOutstanding(JAA_ID, period);
  ok(`${outstanding.length} outstanding for period ${period}`);
  for (const row of outstanding) {
    info(`  ${row.employee.name} (${row.employee.email})`);
  }

  console.log("\n────── 4. First reminder pass (Girish unlinked) ──────");
  const pass1 = await runReminderPass(JAA_ID, period);
  ok(`Pass1: ${pass1.sent} sent / ${pass1.failed} failed / ${pass1.inserted} new period rows`);
  for (const r of pass1.results) {
    info(`  ${r.employeeName}: ok=${r.ok}${r.error ? ` (${r.error})` : ""}`);
  }
  if (!process.env.TELEGRAM_E2E_CHAT_ID && pass1.results[0]?.ok) {
    fail("Expected the first pass to fail because Girish is unlinked, but it succeeded.");
  }

  const realChat = process.env.TELEGRAM_E2E_CHAT_ID;
  if (!realChat) {
    info("\n  TELEGRAM_E2E_CHAT_ID not set — skipping live-send test.");
    info("  To live-test the bot reaching a chat, message @timesheettrial_bot from your");
    info("  own Telegram account, then look up the chat_id from getUpdates and re-run with");
    info("  TELEGRAM_E2E_CHAT_ID=<your_chat_id> bun run scripts/timesheet-e2e.ts");
    console.log("\n\x1b[33m═══════════ DRY-RUN COMPLETE ═══════════\x1b[0m");
    console.log("All DB + bot reachability checks passed.");
    console.log("To complete the live-send portion, supply TELEGRAM_E2E_CHAT_ID.\n");
    process.exit(0);
  }

  console.log("\n────── 5. Simulating /link → set chat_id ──────");
  const chatIdNum = Number(realChat);
  if (Number.isNaN(chatIdNum)) fail("TELEGRAM_E2E_CHAT_ID must be numeric");
  await linkTelegramChatId(girish.id, chatIdNum, "@e2e_test");
  ok(`Linked Girish → chat_id ${chatIdNum}`);

  console.log("\n────── 6. Second reminder pass (linked) ──────");
  const pass2 = await runReminderPass(JAA_ID, period);
  ok(`Pass2: ${pass2.sent} sent / ${pass2.failed} failed`);
  for (const r of pass2.results) {
    info(`  ${r.employeeName}: ok=${r.ok}${r.error ? ` (${r.error})` : ""}`);
  }
  if (pass2.failed > 0) fail("Expected at least one successful send.");

  console.log("\n────── 7. Reset Girish chat_id (clean demo state) ──────");
  // Clear chat_id so demo can re-show the "Awaiting /link" state
  const { sql } = await import("../src/lib/db-postgres");
  if (sql) {
    await sql`UPDATE employees SET telegram_chat_id = NULL WHERE id = ${girish.id}`;
    ok("Cleared. Girish back to unlinked state.");
  }

  console.log("\n\x1b[32m═══════════ E2E COMPLETE ═══════════\x1b[0m\n");
}

main().catch((err) => {
  console.error("\n\x1b[31mE2E FAILED:\x1b[0m", err);
  process.exit(1);
});
