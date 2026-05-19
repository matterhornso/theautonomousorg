/**
 * POST /api/messaging/telegram/[companyId]
 *
 * Per-tenant Telegram inbound webhook. A tenant configures their own bot
 * (own @username, own BotFather token) and sets the webhook URL to this
 * path with their companyId. The route:
 *
 *   1. Verifies the tenant has a per-tenant token stored in user_api_keys
 *      (service_name='telegram_bot_token'). 404 if not — prevents stray
 *      webhooks from hitting a tenant that hasn't enrolled.
 *   2. Verifies the x-telegram-bot-api-secret-token header against
 *      TELEGRAM_WEBHOOK_SECRET (shared platform secret for v3.1; can be
 *      moved to per-tenant in v3.2 if needed).
 *   3. Routes through the CEO orchestrator (or explicit @Role).
 *   4. Writes agent_runs + lesson, replies via sendMessageForCompany.
 *
 * Differs from /api/messaging/telegram (the env-bot route) by:
 *   - Path carries the companyId — no email-lookup fallback
 *   - No timesheet-vertical keyword handling (/link, DONE, HELP) — those
 *     belong to the env trial bot, not BYO bots
 *   - Always uses sendMessageForCompany so replies go through the tenant's bot
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  sendMessageForCompany,
  isTelegramBYOK,
} from "@/lib/telegram";
import {
  getAgent,
  getAgentsByCompany,
  getMemory,
  getMessages,
  addMessage,
  createConversation,
  getConversationsByAgent,
  getMessagingUser,
  createMessagingUser,
  updateDefaultAgent,
  incrementUsage,
} from "@/lib/db";
import { ceoTools, executeCeoTool } from "@/lib/mcp/ceo-tools";
import { createAgentRun, completeAgentRun } from "@/lib/agent-runs";
import { buildLessonsHelper } from "@/lib/lessons";
import { randomUUID } from "crypto";

const client = new Anthropic();

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
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    // 1. Tenant must have enrolled their own bot.
    if (!(await isTelegramBYOK(companyId))) {
      return NextResponse.json(
        { error: "Tenant has no Telegram bot configured" },
        { status: 404 }
      );
    }

    // 2. Webhook secret check.
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = request.headers.get(
        "x-telegram-bot-api-secret-token"
      );
      if (headerSecret !== webhookSecret) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;
    if (!message?.text || !message.from) {
      // Non-text or non-user message — ack and ignore.
      return NextResponse.json({ ok: true });
    }

    const text = message.text.trim();
    const chatId = message.chat.id;
    const telegramUserId = String(message.from.id);
    const displayName =
      [message.from.first_name, message.from.last_name]
        .filter(Boolean)
        .join(" ") || message.from.username || "Telegram user";

    // 3. Resolve / create the messaging_user under this tenant.
    //    For per-tenant bots we scope the lookup by companyId via the
    //    platform_user_id = "tg:<companyId>:<telegramUserId>" namespace,
    //    so two tenants can have the same Telegram user without colliding.
    const platformUserId = `tg:${companyId}:${telegramUserId}`;
    let messagingUser = await getMessagingUser("telegram", platformUserId);
    if (!messagingUser) {
      messagingUser = await createMessagingUser({
        company_id: companyId,
        platform: "telegram",
        platform_user_id: platformUserId,
        display_name: displayName,
      });
    }

    // 4. Find the target agent. Prefer explicit @RoleName, then CEO, then default.
    const agents = await getAgentsByCompany(companyId);
    if (agents.length === 0) {
      await sendMessageForCompany(
        companyId,
        chatId,
        "Your workspace doesn't have any agents yet. Visit theautonomous.org to provision your AI workforce."
      );
      return NextResponse.json({ ok: true });
    }

    type AgentRow = NonNullable<Awaited<ReturnType<typeof getAgent>>>;
    let targetAgent: AgentRow | undefined;
    let userMessage = text;

    const mentionMatch = text.match(/^@([\w\s-]+?)\s+([\s\S]+)$/);
    if (mentionMatch) {
      const role = mentionMatch[1].trim();
      const matched = agents.find(
        (a) => a.role.toLowerCase() === role.toLowerCase()
      );
      if (matched) {
        targetAgent = matched;
        userMessage = mentionMatch[2].trim();
        await updateDefaultAgent(messagingUser.id, matched.id);
      }
    }
    if (!targetAgent) {
      const ceo = agents.find((a) => a.role === "CEO");
      if (ceo) {
        targetAgent = ceo;
      } else if (messagingUser.default_agent_id) {
        const fallback = await getAgent(messagingUser.default_agent_id);
        if (fallback) targetAgent = fallback;
      }
      if (!targetAgent) {
        targetAgent = agents[0];
        await updateDefaultAgent(messagingUser.id, targetAgent.id);
      }
    }

    // 5. Conversation thread per Telegram user.
    const threadTitle = `telegram:${platformUserId}`;
    const existingConversations = await getConversationsByAgent(targetAgent.id);
    let conversation = existingConversations.find(
      (c) => c.title === threadTitle
    );
    if (!conversation) {
      conversation = await createConversation(targetAgent.id, threadTitle);
    }
    await addMessage({
      conversation_id: conversation.id,
      role: "user",
      content: userMessage,
    });

    // 6. Build system prompt with memory + lessons.
    const history = await getMessages(conversation.id, 30);
    const apiMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const memories = await getMemory(targetAgent.id);
    const memorySection = memories.length
      ? "\n\n## What You Remember\n" +
        memories
          .map((m) => `- **${m.key}:** [${m.value.replace(/[[\]]/g, "")}]`)
          .join("\n")
      : "";
    let lessonsSection = "";
    try {
      const lessons = await buildLessonsHelper({
        firmId: companyId,
        agentId: targetAgent.id,
      }).readRecent({ limit: 5 });
      if (lessons.length > 0) {
        lessonsSection =
          "\n\n## Recent Lessons\nApply when relevant.\n" +
          lessons
            .map((l) => `- ${l.taskDescription} (${l.outputAccepted})`)
            .join("\n");
      }
    } catch (err) {
      console.warn("[telegram/byo] lesson lookup failed:", err);
    }
    const systemPrompt =
      targetAgent.system_prompt +
      memorySection +
      lessonsSection +
      `\n\n## Messaging Context\nYou are responding via Telegram to ${displayName}. Keep responses concise and mobile-friendly. Use Markdown formatting sparingly — Telegram supports *bold*, _italic_, and \`code\`.`;

    // 7. Open the run record.
    const runRecord = await createAgentRun({
      companyId,
      agentRole: targetAgent.role,
      agentId: targetAgent.id,
      triggeredBy: "user",
      triggerDetail: `Telegram (BYO) from ${displayName}`,
      input: { message: userMessage, conversationId: conversation.id },
    });
    const runId = runRecord?.id ?? `run_tmp_${randomUUID()}`;

    // 8. Call Claude — CEO gets ceoTools with one tool-use iteration.
    const isCeo = targetAgent.role === "CEO";
    const tools = isCeo ? ceoTools : undefined;
    let response;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: apiMessages,
        ...(tools ? { tools } : {}),
      });
    } catch (err) {
      await completeAgentRun(runId, {
        status: "failed",
        errorDetail: err instanceof Error ? err.message : String(err),
        modelUsed: "claude-sonnet-4-6",
        provider: "anthropic",
      });
      throw err;
    }

    let toolCalledLabel: string | null = null;
    if (isCeo && response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      ) as Array<{
        type: "tool_use";
        id: string;
        name: string;
        input: Record<string, unknown>;
      }>;
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];
      for (const tu of toolUseBlocks) {
        try {
          const result = await executeCeoTool(
            tu.name,
            tu.input,
            companyId,
            conversation.id
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: result,
          });
          toolCalledLabel = tu.name;
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `tool failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          ...apiMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ],
      });
    }

    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    await addMessage({
      conversation_id: conversation.id,
      role: "assistant",
      content: responseText,
    });
    await incrementUsage(companyId, "message_count");

    // 9. Close the run + write lesson.
    await completeAgentRun(runId, {
      status: "completed",
      output: { response: responseText, ceoTool: toolCalledLabel ?? undefined },
      modelUsed: "claude-sonnet-4-6",
      provider: "anthropic",
      tokensIn: response.usage?.input_tokens,
      tokensOut: response.usage?.output_tokens,
      summary: responseText.slice(0, 200),
    });
    try {
      await buildLessonsHelper({
        firmId: companyId,
        agentId: targetAgent.id,
      }).write({
        agentId: targetAgent.id,
        runId,
        taskDescription: userMessage.slice(0, 200),
        outputAccepted: "unknown",
      });
    } catch (err) {
      console.warn("[telegram/byo] lesson write failed; continuing:", err);
    }

    // 10. Reply through the tenant's bot.
    const agentLabel =
      agents.length > 1 ? `*@${targetAgent.role}:*\n` : "";
    await sendMessageForCompany(companyId, chatId, agentLabel + responseText);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram BYO webhook error:", error);
    // Always 200 so Telegram doesn't retry on app errors.
    return NextResponse.json({ ok: true });
  }
}
