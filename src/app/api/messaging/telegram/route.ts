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

    // Validate webhook secret
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = request.headers.get(
        "x-telegram-bot-api-secret-token"
      );
      if (headerSecret !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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

    // Handle /start command
    if (text === "/start") {
      await sendMessage(
        chatId,
        `Welcome to TheAutonomous! 🤖\n\n` +
          `I bridge your AI agents to Telegram so you can chat with them on the go.\n\n` +
          `*Getting started:*\n` +
          `1. Link your account at theautonomous.org\n` +
          `2. Use \`@RoleName message\` to talk to a specific agent (e.g. \`@Sales draft outreach for Acme Corp\`)\n` +
          `3. Or just send a message to talk to your default agent\n\n` +
          `*Commands:*\n` +
          `/agents — List your available agents\n` +
          `/start — Show this welcome message`
      );
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
        memories.map((m) => `- **${m.key}:** ${m.value}`).join("\n");
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
