/**
 * Inbound email webhook — Resend inbound parse → CEO orchestrator.
 *
 * Mirrors the Telegram inbound flow (src/app/api/messaging/telegram/route.ts)
 * but lighter: no per-employee link state, no /agents command UX, no markdown
 * formatting tweaks. One body of plain text in, one reply out.
 *
 * Setup:
 *   1. Configure Resend inbound for an address on your domain
 *      (e.g. agents@theautonomous.org or {handle}@inbox.theautonomous.org)
 *   2. Point the inbound webhook at https://theautonomous.org/api/messaging/email
 *   3. Set RESEND_INBOUND_SECRET (or RESEND_WEBHOOK_SECRET) in env. Resend
 *      sends it back in the `x-resend-secret` header on every delivery.
 *
 * Sender lookup: we identify the company by matching the From address
 * against either an existing messaging_users row (platform='email') or a
 * user_profile row tied to a Clerk user that owns a company. If we can't
 * find a tenant, the email is silently dropped (return 200 so Resend
 * doesn't retry).
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "@/lib/email";
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
  getCompaniesByUser,
} from "@/lib/db";
import { ceoTools, executeCeoTool } from "@/lib/mcp/ceo-tools";
import { createAgentRun, completeAgentRun } from "@/lib/agent-runs";
import { buildLessonsHelper } from "@/lib/lessons";
import { randomUUID } from "crypto";

const client = new Anthropic();

// Resend inbound payloads vary a bit; we accept the common shapes.
interface InboundPayload {
  type?: string;
  data?: {
    from?: string | { address?: string; name?: string };
    to?: Array<string | { address?: string }> | string;
    subject?: string;
    text?: string;
    html?: string;
  };
  // Fallback: some configurations POST the email fields at the top level
  from?: string | { address?: string; name?: string };
  subject?: string;
  text?: string;
  html?: string;
}

function extractEmail(
  value: unknown
): { address: string; name?: string } | null {
  if (!value) return null;
  if (typeof value === "string") {
    // "Name <address@host>" or "address@host"
    const m = value.match(/<([^>]+)>/);
    return { address: (m?.[1] ?? value).trim() };
  }
  if (typeof value === "object" && "address" in (value as Record<string, unknown>)) {
    const v = value as { address?: string; name?: string };
    if (typeof v.address !== "string") return null;
    return { address: v.address, name: v.name };
  }
  return null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Trim quoted reply chains so the agent doesn't see the whole thread on
// every turn. Heuristic: cut at the first reply-style marker.
const REPLY_MARKERS = [
  /^On .+ wrote:\s*$/m,
  /^From:.+$/m,
  /^-{2,}\s*Original Message\s*-{2,}$/m,
  /^>+\s/m,
];
function stripQuotedReply(text: string): string {
  let cut = text.length;
  for (const re of REPLY_MARKERS) {
    const m = text.match(re);
    if (m && m.index !== undefined && m.index < cut) {
      cut = m.index;
    }
  }
  return text.slice(0, cut).trim();
}

export async function POST(request: NextRequest) {
  try {
    // Optional HMAC-ish verification — Resend sends the configured secret
    // back as a header. Both names are common in the wild.
    const required =
      process.env.RESEND_INBOUND_SECRET ?? process.env.RESEND_WEBHOOK_SECRET;
    if (required) {
      const got =
        request.headers.get("x-resend-secret") ??
        request.headers.get("x-webhook-secret") ??
        "";
      if (got !== required) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const payload = (await request.json()) as InboundPayload;
    const data = payload.data ?? payload;
    const from = extractEmail(data.from);
    if (!from) {
      console.warn("[email] inbound: no From address; ignoring");
      return NextResponse.json({ ok: true });
    }

    const subject = (data.subject ?? "(no subject)").trim();
    const rawBody =
      (data.text && data.text.trim()) ||
      (data.html ? stripHtmlToText(data.html) : "");
    const body = stripQuotedReply(rawBody);
    if (!body) {
      console.warn("[email] inbound: empty body; ignoring");
      return NextResponse.json({ ok: true });
    }

    // Look up the sender. messaging_users platform_user_id = lowercase email.
    const platformUserId = from.address.toLowerCase();
    let messagingUser = await getMessagingUser("email", platformUserId);
    let companyId: string;

    if (messagingUser) {
      companyId = messagingUser.company_id;
    } else {
      // Try to bind by Clerk user_profile.email → companies(user_id) lookup.
      // If no Clerk user matches, silently drop. (Cold inbound from unknown
      // addresses should not provision a tenant.)
      const { sql } = await import("@/lib/db-postgres");
      let resolvedUserId: string | null = null;
      if (sql) {
        const rows = (await sql`
          SELECT user_id FROM user_profiles
          WHERE LOWER(email) = ${platformUserId}
          LIMIT 1
        `) as Array<{ user_id: string }>;
        resolvedUserId = rows[0]?.user_id ?? null;
      }
      if (!resolvedUserId) {
        console.log(
          "[email] inbound: no Autonomous user for " + platformUserId
        );
        await sendEmail({
          to: from.address,
          subject: `Re: ${subject}`,
          body:
            "Thanks for writing in. We didn't find a workspace tied to this email yet — please sign up at https://theautonomous.org first, and we'll start routing your messages to your agents.",
        });
        return NextResponse.json({ ok: true });
      }
      const companies = await getCompaniesByUser(resolvedUserId);
      const firstCompany = companies[0];
      if (!firstCompany) {
        return NextResponse.json({ ok: true });
      }
      companyId = firstCompany.id;
      messagingUser = await createMessagingUser({
        company_id: companyId,
        platform: "email",
        platform_user_id: platformUserId,
        display_name: from.name ?? from.address,
      });
    }

    // Find the agents in the company. Prefer CEO orchestrator; fall back to
    // the user's default; finally first agent.
    const agents = await getAgentsByCompany(companyId);
    if (agents.length === 0) {
      await sendEmail({
        to: from.address,
        subject: `Re: ${subject}`,
        body:
          "Your workspace doesn't have any agents yet. Visit https://theautonomous.org to provision your AI workforce.",
      });
      return NextResponse.json({ ok: true });
    }

    // Check for @RoleName at the start of the body (same convention as Telegram).
    type AgentRow = NonNullable<Awaited<ReturnType<typeof getAgent>>>;
    let targetAgent: AgentRow | undefined;
    let userMessage = body;
    const mentionMatch = body.match(/^@([\w\s-]+?)\s+([\s\S]+)$/);
    if (mentionMatch) {
      const role = mentionMatch[1].trim();
      const matched = agents.find(
        (a) => a.role.toLowerCase() === role.toLowerCase()
      );
      if (matched) {
        targetAgent = matched;
        userMessage = mentionMatch[2].trim();
        if (messagingUser)
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

    // Conversation thread keyed on the sender's email so replies stack.
    const threadTitle = `email:${platformUserId}`;
    const existingConversations = await getConversationsByAgent(targetAgent.id);
    let conversation = existingConversations.find(
      (c) => c.title === threadTitle
    );
    if (!conversation) {
      conversation = await createConversation(targetAgent.id, threadTitle);
    }

    // Persist the inbound user message
    await addMessage({
      conversation_id: conversation.id,
      role: "user",
      content: subject ? `(subject: ${subject})\n\n${userMessage}` : userMessage,
    });

    // Build the prompt: agent system prompt + memory + recent lessons
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
      console.warn("[email] lesson lookup failed:", err);
    }
    const systemPrompt =
      targetAgent.system_prompt +
      memorySection +
      lessonsSection +
      `\n\n## Messaging Context\nYou are replying to an email from ${from.name ?? from.address}. Write in plain prose; no Markdown bold/italics/code blocks (this is rendered as plain-text email). Keep responses focused and professional. Close with a single-line sign-off (e.g. "— ${targetAgent.role} agent · The Autonomous").`;

    // Open the run row
    const runRecord = await createAgentRun({
      companyId,
      agentRole: targetAgent.role,
      agentId: targetAgent.id,
      triggeredBy: "user",
      triggerDetail: `Email from ${from.address}`,
      input: { from: from.address, subject, message: userMessage },
    });
    const runId = runRecord?.id ?? `run_tmp_${randomUUID()}`;

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

    // CEO tool-use loop — single iteration max
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

    await completeAgentRun(runId, {
      status: "completed",
      output: {
        response: responseText,
        ceoTool: toolCalledLabel ?? undefined,
      },
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
      console.warn("[email] lesson write failed; continuing:", err);
    }

    // Send the reply
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    await sendEmail({
      to: from.address,
      subject: replySubject,
      body: responseText,
    });

    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    console.error("[email] inbound error:", error);
    // Always 200 so Resend doesn't hammer us with retries on our own bugs.
    return NextResponse.json({ ok: true });
  }
}
