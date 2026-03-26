/**
 * Daily Debrief Generator + Push Delivery
 *
 * Aggregates all agent activity from the last 24 hours and produces
 * a structured executive summary using Claude Haiku.
 * Delivers via: Telegram → Email → Dashboard (fallback chain)
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getActivityFeed,
  getAgentsByCompany,
  getTasksByCompany,
  getUsage,
  createDebrief,
  getUserApiKey,
  type Debrief,
} from "./db";

const client = new Anthropic();

export async function generateDebrief(
  companyId: string,
  userId: string
): Promise<Debrief> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const agents = await getAgentsByCompany(companyId);
  const allTasks = await getTasksByCompany(companyId);
  const activity = await getActivityFeed(companyId, 50);
  const usage = await getUsage(companyId);

  // Filter to last 24h
  const recentTasks = allTasks.filter(
    (t) => new Date(t.created_at) >= yesterday
  );
  const tasksDone = recentTasks.filter((t) => t.status === "done");
  const tasksFailed = recentTasks.filter((t) => t.status === "failed");

  const recentActivity = activity
    .filter((a) => new Date(a.created_at) >= yesterday)
    .map((a) => `- ${a.agent_role}: ${a.title} (${a.status})`)
    .join("\n");

  // Generate summary with Claude Haiku (fast + cheap)
  const result = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system:
      "You are an executive assistant producing a daily debrief for a CEO. Be concise, specific, and actionable. Use bullet points. Include numbers where relevant.",
    messages: [
      {
        role: "user",
        content: `Generate a daily debrief for the last 24 hours.

Company has ${agents.length} AI agents: ${agents.map((a) => a.role).join(", ")}

Tasks completed yesterday: ${tasksDone.length}
Tasks failed: ${tasksFailed.length}
${tasksDone.length > 0 ? "Completed tasks:\n" + tasksDone.map((t) => `- ${t.title}`).join("\n") : ""}
${tasksFailed.length > 0 ? "Failed tasks:\n" + tasksFailed.map((t) => `- ${t.title}: ${t.error_message || "unknown error"}`).join("\n") : ""}

Monthly usage so far: ${usage.task_count} tasks, ${usage.message_count} messages

Recent activity:
${recentActivity || "No activity in the last 24 hours."}

Format as:
## Daily Debrief — [date]

### What Happened
- bullet points of key accomplishments

### Attention Needed
- any failures, blockers, or risks

### Recommendations
- 2-3 actionable next steps

### Metrics
- key numbers at a glance`,
      },
    ],
  });

  const content =
    result.content[0].type === "text"
      ? result.content[0].text
      : "Debrief generation failed.";

  // Attempt push delivery: Telegram → Email → Dashboard
  let deliveredVia = "dashboard";

  // Try Telegram
  const telegramResult = await pushViaTelegram(companyId, content);
  if (telegramResult.sent) {
    deliveredVia = "telegram";
  } else {
    // Try email
    const emailResult = await pushViaEmail(content);
    if (emailResult.sent) {
      deliveredVia = "email";
    }
  }

  return await createDebrief({
    company_id: companyId,
    user_id: userId,
    content,
    period_start: yesterday.toISOString(),
    period_end: now.toISOString(),
    delivered_via: deliveredVia,
  });
}

/**
 * Send debrief via Telegram bot.
 * Requires the company to have a telegram_bot key stored.
 */
async function pushViaTelegram(
  companyId: string,
  content: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const botToken = await getUserApiKey(companyId, "telegram_bot");
    if (!botToken) return { sent: false, error: "no_bot_token" };

    // Get the chat ID — stored as telegram_chat_id
    const chatId = await getUserApiKey(companyId, "telegram_chat_id");
    if (!chatId) return { sent: false, error: "no_chat_id" };

    // Truncate to Telegram's 4096 char limit
    const message = content.length > 4000
      ? content.slice(0, 3997) + "..."
      : content;

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🗞️ *Daily Debrief*\n\n${message}`,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!res.ok) {
      console.error("[debrief] Telegram push failed:", res.status);
      return { sent: false, error: `telegram_${res.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("[debrief] Telegram push error:", error);
    return { sent: false, error: "telegram_error" };
  }
}

/**
 * Send debrief via email using Resend.
 */
async function pushViaEmail(
  content: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { sent: false, error: "no_resend_key" };

    // For now, we don't have the user's email in this context
    // This will be enhanced when team permissions are added
    // and we can look up the user's Clerk email
    return { sent: false, error: "email_not_configured" };
  } catch (error) {
    console.error("[debrief] Email push error:", error);
    return { sent: false, error: "email_error" };
  }
}

/**
 * Send a Telegram message to a company's bot.
 * Reusable helper for notifications and debrief push.
 */
export async function sendTelegramNotification(
  companyId: string,
  message: string
): Promise<boolean> {
  try {
    const botToken = await getUserApiKey(companyId, "telegram_bot");
    const chatId = await getUserApiKey(companyId, "telegram_chat_id");
    if (!botToken || !chatId) return false;

    const truncated = message.length > 4000 ? message.slice(0, 3997) + "..." : message;

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: truncated,
          parse_mode: "Markdown",
        }),
      }
    );

    return res.ok;
  } catch {
    return false;
  }
}
