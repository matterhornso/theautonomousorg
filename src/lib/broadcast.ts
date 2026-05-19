/**
 * Broadcast agent (migration 009).
 *
 * Lets a firm admin drive outbound messaging from Telegram: the admin DMs the
 * bot in plain English, Claude classifies the intent, and the platform fans
 * the result out to the firm's contact list over email + Telegram.
 *
 * v1 actions:
 *   - broadcast       — send a message to every active contact
 *   - send_reminders  — run the timesheet reminder pass
 *
 * Admin enrolment is code-gated: an admin sends `/register <code>` and the
 * code is checked against env BROADCAST_ADMIN_CODE; the chat is then bound to
 * the firm in env BROADCAST_COMPANY_ID.
 */

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { sendEmail } from "./email";
import { sendMessageForCompany } from "./telegram";
import { listContacts } from "./contacts";
import { runReminderPass, currentPeriodKey } from "./timesheets";

const client = new Anthropic();

// ─── Types ─────────────────────────────────────────────────────────────

export interface BroadcastAdmin {
  telegramChatId: number;
  companyId: string;
  name: string | null;
}

export type BroadcastAction = "broadcast" | "send_reminders" | "unknown";

export interface InterpretedCommand {
  action: BroadcastAction;
  /** Outbound message body — populated when action === "broadcast". */
  message: string;
  /** Short email subject — populated when action === "broadcast". */
  subject: string;
  /** Human-readable line to send back to the admin. */
  reply: string;
}

export interface BroadcastResult {
  totalContacts: number;
  emailSent: number;
  emailFailed: number;
  telegramSent: number;
  telegramFailed: number;
}

async function getSql() {
  if (!process.env.DATABASE_URL) return null;
  const mod = await import("./db-postgres");
  return mod.sql;
}

// ─── Admin enrolment ───────────────────────────────────────────────────

interface AdminRow {
  telegram_chat_id: string | number;
  company_id: string;
  name: string | null;
}

export async function findBroadcastAdmin(
  chatId: number
): Promise<BroadcastAdmin | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT telegram_chat_id, company_id, name
    FROM broadcast_admins WHERE telegram_chat_id = ${chatId} LIMIT 1
  `) as AdminRow[];
  const r = rows[0];
  if (!r) return null;
  return {
    telegramChatId: Number(r.telegram_chat_id),
    companyId: r.company_id,
    name: r.name,
  };
}

/**
 * Enrol a Telegram chat as a broadcast admin. The code must match env
 * BROADCAST_ADMIN_CODE; the chat is bound to env BROADCAST_COMPANY_ID.
 * Idempotent — re-registering the same chat just refreshes the name.
 */
export async function registerBroadcastAdmin(
  chatId: number,
  code: string,
  name: string | null
): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  const expected = process.env.BROADCAST_ADMIN_CODE;
  if (!expected) {
    return { ok: false, error: "Broadcast admin registration is not configured." };
  }
  if (code !== expected) {
    return { ok: false, error: "That code is not valid." };
  }
  const companyId = process.env.BROADCAST_COMPANY_ID;
  if (!companyId) {
    return { ok: false, error: "No firm is configured for broadcast (BROADCAST_COMPANY_ID)." };
  }
  const sql = await getSql();
  if (!sql) return { ok: false, error: "Database is not configured." };
  await sql`
    INSERT INTO broadcast_admins (telegram_chat_id, company_id, name)
    VALUES (${chatId}, ${companyId}, ${name})
    ON CONFLICT (telegram_chat_id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, broadcast_admins.name)
  `;
  return { ok: true, companyId };
}

// ─── Command interpretation (the agent) ────────────────────────────────

const ROUTE_TOOL: Anthropic.Tool = {
  name: "route_command",
  description:
    "Classify a firm admin's instruction and produce the resulting action.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["broadcast", "send_reminders", "unknown"],
        description:
          "broadcast = send a message to all firm contacts. send_reminders = trigger the weekly timesheet reminder pass. unknown = the instruction is unclear or unsupported.",
      },
      message: {
        type: "string",
        description:
          "When action is broadcast: the exact message body to send to every contact, written in clear, friendly, complete sentences. Empty otherwise.",
      },
      subject: {
        type: "string",
        description:
          "When action is broadcast: a short email subject line (under 70 chars). Empty otherwise.",
      },
      reply: {
        type: "string",
        description:
          "A short line to send back to the admin confirming what you understood and are about to do (or, for unknown, asking them to rephrase).",
      },
    },
    required: ["action", "message", "subject", "reply"],
  },
};

const SYSTEM = `You are the broadcast assistant for a firm's operations admin.
The admin messages you on Telegram to send announcements to everyone at the firm,
or to trigger the weekly timesheet reminder run.

Decide the action:
- "broadcast": the admin wants a message sent to all contacts. Turn their
  instruction into a polished, ready-to-send message. Do not add greetings like
  "Dear all" unless asked; keep it natural and concise. Never invent facts the
  admin did not give you.
- "send_reminders": the admin wants timesheet reminders sent out now.
- "unknown": the instruction is unclear, unsafe, or unsupported.

Always call the route_command tool exactly once.`;

/**
 * Interpret an admin's free-text instruction. Always returns a structured
 * result; on any model error, falls back to action "unknown".
 */
export async function interpretCommand(
  text: string
): Promise<InterpretedCommand> {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      tools: [ROUTE_TOOL],
      tool_choice: { type: "tool", name: "route_command" },
      messages: [{ role: "user", content: text }],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return {
        action: "unknown",
        message: "",
        subject: "",
        reply: "I couldn't process that — please rephrase.",
      };
    }
    const input = toolUse.input as Record<string, unknown>;
    const action = input.action as BroadcastAction;
    return {
      action:
        action === "broadcast" || action === "send_reminders"
          ? action
          : "unknown",
      message: typeof input.message === "string" ? input.message : "",
      subject: typeof input.subject === "string" ? input.subject : "",
      reply:
        typeof input.reply === "string" && input.reply
          ? input.reply
          : "Working on it.",
    };
  } catch (err) {
    console.error("[broadcast] interpretCommand failed:", err);
    return {
      action: "unknown",
      message: "",
      subject: "",
      reply: "Something went wrong interpreting that — please try again.",
    };
  }
}

// ─── Fan-out ───────────────────────────────────────────────────────────

/**
 * Send a message to every active contact at a firm. Email goes to contacts
 * with an address; Telegram goes to contacts who've linked a chat. Failures
 * on individual contacts are counted, never thrown — one bad address must
 * not abort the whole broadcast.
 */
export async function runBroadcast(
  companyId: string,
  message: string,
  subject: string
): Promise<BroadcastResult> {
  const contacts = (await listContacts(companyId)).filter((c) => c.active);
  const result: BroadcastResult = {
    totalContacts: contacts.length,
    emailSent: 0,
    emailFailed: 0,
    telegramSent: 0,
    telegramFailed: 0,
  };
  const emailSubject = subject.trim() || "A message from your firm";

  for (const contact of contacts) {
    if (contact.email) {
      try {
        const res = await sendEmail({
          to: contact.email,
          subject: emailSubject,
          body: message,
        });
        if (res.sent) result.emailSent++;
        else result.emailFailed++;
      } catch {
        result.emailFailed++;
      }
    }
    if (contact.telegramChatId !== null) {
      try {
        await sendMessageForCompany(companyId, contact.telegramChatId, message);
        result.telegramSent++;
      } catch {
        result.telegramFailed++;
      }
    }
  }
  return result;
}

/** Run the timesheet reminder pass for the current period. */
export async function sendReminders(companyId: string): Promise<{
  sent: number;
  failed: number;
  periodKey: string;
}> {
  const periodKey = currentPeriodKey();
  const pass = await runReminderPass(companyId, periodKey);
  return { sent: pass.sent, failed: pass.failed, periodKey };
}

// ─── Audit log ─────────────────────────────────────────────────────────

export async function logBroadcast(input: {
  companyId: string;
  adminChatId: number;
  instruction: string;
  action: BroadcastAction;
  message?: string | null;
  emailSent?: number;
  telegramSent?: number;
  failed?: number;
}): Promise<void> {
  const sql = await getSql();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO broadcasts
        (id, company_id, admin_chat_id, instruction, action, message,
         email_sent, telegram_sent, failed)
      VALUES (
        ${`bc_${randomUUID()}`},
        ${input.companyId},
        ${input.adminChatId},
        ${input.instruction.slice(0, 2000)},
        ${input.action},
        ${input.message ?? null},
        ${input.emailSent ?? 0},
        ${input.telegramSent ?? 0},
        ${input.failed ?? 0}
      )
    `;
  } catch (err) {
    console.warn("[broadcast] logBroadcast failed:", err);
  }
}

export interface BroadcastLogEntry {
  id: string;
  instruction: string;
  action: string;
  message: string | null;
  emailSent: number;
  telegramSent: number;
  failed: number;
  createdAt: Date;
}

export async function recentBroadcasts(
  companyId: string,
  limit = 10
): Promise<BroadcastLogEntry[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, instruction, action, message, email_sent, telegram_sent, failed, created_at
    FROM broadcasts
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: r.id as string,
    instruction: r.instruction as string,
    action: r.action as string,
    message: (r.message as string | null) ?? null,
    emailSent: Number(r.email_sent),
    telegramSent: Number(r.telegram_sent),
    failed: Number(r.failed),
    createdAt: r.created_at as Date,
  }));
}
