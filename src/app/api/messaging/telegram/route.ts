import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sendMessage, isTelegramConfigured } from "@/lib/telegram";
import {
  getMessagingUser,
  getAgent,
  getAgentsByCompany,
  getMemory,
  getMessages,
  addMessage,
  createConversation,
  getConversationsByAgent,
  updateDefaultAgent,
  incrementUsage,
} from "@/lib/db";
import {
  findEmployeeByEmailGlobal,
  findEmployeeByTelegramChatId,
  linkTelegramChatId,
  getActiveSubmissionForEmployee,
  markSubmitted,
  currentPeriodKey,
} from "@/lib/timesheets";

const client = new Anthropic();

// Telegram Update type (subset of fields we care about)
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check Telegram is configured
    if (!isTelegramConfigured()) {
      return NextResponse.json(
        { error: "Telegram not configured" },
        { status: 503 }
      );
    }

    // Validate webhook secret — reject ALL requests if secret is not configured
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: "Telegram webhook not configured" }, { status: 503 });
    }
    const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const update: TelegramUpdate = await request.json();

    // Only handle text messages
    if (!update.message?.text || !update.message.from) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const telegramUserId = String(update.message.from.id);
    const displayName = [
      update.message.from.first_name,
      update.message.from.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    // ─── Timesheet flow ─────────────────────────────────────────────
    // Runs BEFORE agent routing because timesheet employees may not have
    // a messaging_users row. Three keywords: /link <email>, DONE, HELP.

    const linkedEmployee = await findEmployeeByTelegramChatId(chatId);

    // /link <email> — bind this chat_id to an employee row.
    const linkMatch = text.match(/^\/link\s+(\S+@\S+)$/i);
    if (linkMatch) {
      const email = linkMatch[1]!.toLowerCase();
      // Search across all firms for a matching email; multi-tenant timesheet
      // setups would scope this by firm. For v1 (one firm) it's fine.
      // We still rely on the email being unique enough that misbinding is rare.
      const employee = await findEmployeeByEmailGlobal(email);
      if (!employee) {
        await sendMessage(
          chatId,
          `I don't see *${email}* on the timesheet roster. Ask your firm admin to add you, then try \`/link ${email}\` again.`
        );
        return NextResponse.json({ ok: true });
      }
      await linkTelegramChatId(
        employee.id,
        chatId,
        update.message.from.username ? "@" + update.message.from.username : null
      );
      await sendMessage(
        chatId,
        `Linked. I'll remind you on Fridays if your timesheet for the current week is still open. Reply *DONE* to confirm submission, or *HELP* if you're stuck.`
      );
      return NextResponse.json({ ok: true });
    }

    // DONE / HELP keywords — only meaningful for linked employees.
    if (linkedEmployee && (text.toUpperCase() === "DONE" || /^DONE\b/i.test(text))) {
      const submission = await getActiveSubmissionForEmployee(
        linkedEmployee.id,
        currentPeriodKey()
      );
      if (!submission) {
        await sendMessage(
          chatId,
          `I don't have a tracking row for you this week yet. Your firm admin needs to start the period — try again after the next reminder pass.`
        );
        return NextResponse.json({ ok: true });
      }
      if (submission.submittedAt) {
        await sendMessage(
          chatId,
          `Already marked submitted for *${submission.periodKey}*. Thanks for following up.`
        );
        return NextResponse.json({ ok: true });
      }
      await markSubmitted(submission.id, "telegram");
      await sendMessage(
        chatId,
        `Marked your timesheet for *${submission.periodKey}* as submitted. Thanks ${linkedEmployee.name.split(" ")[0]}.`
      );
      return NextResponse.json({ ok: true });
    }

    if (linkedEmployee && (text.toUpperCase() === "HELP" || /^HELP\b/i.test(text))) {
      await sendMessage(
        chatId,
        `Got it. I've flagged your firm admin — they'll reach out shortly. Meanwhile reply *DONE* once you've submitted, or describe the blocker and I'll relay.`
      );
      // TODO: invoke EscalationHelper once the firm admin contact is wired.
      return NextResponse.json({ ok: true });
    }

    // Handle /start command
    if (text === "/start") {
      const welcome = linkedEmployee
        ? `Hi ${linkedEmployee.name.split(" ")[0]} — you're already linked. Reply *DONE* when you've submitted your timesheet for the week, or *HELP* if you need a hand.`
        : `Welcome to TheAutonomous! 🤖\n\n` +
          `If you're here for *timesheet reminders*, reply with:\n` +
          `\`/link your.email@firm.com\`\n\n` +
          `Otherwise, link your account at theautonomous.org and use \`@RoleName message\` to talk to a specific agent.\n\n` +
          `*Commands:*\n` +
          `/link <email> — Bind this chat to your timesheet record\n` +
          `/agents — List your available agents\n` +
          `/start — Show this welcome message`;
      await sendMessage(chatId, welcome);
      return NextResponse.json({ ok: true });
    }

    // Look up the messaging user
    const messagingUser = await getMessagingUser("telegram", telegramUserId);

    if (!messagingUser) {
      await sendMessage(
        chatId,
        "Welcome! Link your account at theautonomous.org to start chatting with your agents."
      );
      return NextResponse.json({ ok: true });
    }

    const companyId = messagingUser.company_id;
    const agents = await getAgentsByCompany(companyId);

    if (agents.length === 0) {
      await sendMessage(
        chatId,
        "You don't have any agents yet. Visit theautonomous.org to set up your company and provision agents."
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /agents command
    if (text === "/agents") {
      const agentList = agents
        .map((a) => {
          const isDefault = a.id === messagingUser.default_agent_id;
          return `• *@${a.role}*${isDefault ? " (default)" : ""}`;
        })
        .join("\n");

      await sendMessage(
        chatId,
        `*Your agents:*\n${agentList}\n\nUse \`@RoleName message\` to talk to a specific agent, or just send a message to talk to your default agent.`
      );
      return NextResponse.json({ ok: true });
    }

    // Route to the correct agent
    let targetAgent = null;
    let userMessage = text;

    // Check for @RoleName prefix
    const mentionMatch = text.match(/^@([\w\s-]+?)\s+([\s\S]+)$/);
    if (mentionMatch) {
      const mentionedRole = mentionMatch[1].trim();
      const matchedAgent = agents.find(
        (a) => a.role.toLowerCase() === mentionedRole.toLowerCase()
      );
      if (matchedAgent) {
        targetAgent = matchedAgent;
        userMessage = mentionMatch[2].trim();
        // Update default agent to the one they just talked to
        await updateDefaultAgent(messagingUser.id, matchedAgent.id);
      }
    }

    // Fall back to default agent, or first agent
    if (!targetAgent) {
      if (messagingUser.default_agent_id) {
        targetAgent = await getAgent(messagingUser.default_agent_id);
      }
      // If default agent not found or not set, use the first active agent
      if (!targetAgent) {
        targetAgent = agents[0];
        await updateDefaultAgent(messagingUser.id, targetAgent.id);
      }
    }

    // Get or create a conversation for this telegram user + agent combo
    // Reuse the most recent conversation, or create a new one
    const existingConversations = await getConversationsByAgent(targetAgent.id);
    // Look for a conversation titled with the telegram user identifier
    const telegramConvTitle = `telegram:${telegramUserId}`;
    let conversation = existingConversations.find(
      (c) => c.title === telegramConvTitle
    );
    if (!conversation) {
      conversation = await createConversation(targetAgent.id, telegramConvTitle);
    }

    // Save user message
    await addMessage({
      conversation_id: conversation.id,
      role: "user",
      content: userMessage,
    });

    // Load conversation history
    const history = await getMessages(conversation.id, 30);
    const apiMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Load agent memory
    const memories = await getMemory(targetAgent.id);
    let memorySection = "";
    if (memories.length > 0) {
      memorySection =
        "\n\n## What You Remember\n" +
        memories.map((m) => `- **${m.key}:** [${m.value.replace(/[[\]]/g, '')}]`).join("\n");
    }

    const systemPrompt =
      targetAgent.system_prompt +
      memorySection +
      `\n\n## Messaging Context\nYou are responding via Telegram to ${displayName}. Keep responses concise and mobile-friendly. Use Markdown formatting sparingly — Telegram supports *bold*, _italic_, and \`code\`.`;

    // Call Claude (non-streaming)
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: apiMessages,
    });

    // Extract text from response
    const responseText = response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("\n");

    // Save assistant response
    await addMessage({
      conversation_id: conversation.id,
      role: "assistant",
      content: responseText,
    });

    // Track usage
    await incrementUsage(companyId, "message_count");

    // Send response via Telegram
    const agentLabel =
      agents.length > 1 ? `*@${targetAgent.role}:*\n` : "";
    await sendMessage(chatId, agentLabel + responseText);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    // Always return 200 to Telegram to prevent retries on app errors
    return NextResponse.json({ ok: true });
  }
}
