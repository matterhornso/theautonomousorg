import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import {
  getAgent,
  addMessage,
  createConversation,
  getConversation,
  getMessages,
  getMemory,
  incrementUsage,
} from "@/lib/db";
import { buildLessonsHelper } from "@/lib/lessons";
import { dispatchMentions } from "@/lib/mention-dispatch";
import { createCompletion, getLLMConfigForCompany } from "@/lib/llm-router";
import { createAgentRun, completeAgentRun } from "@/lib/agent-runs";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { agentId, conversationId, message } = (await request.json()) as {
    agentId: string;
    conversationId?: string;
    message: string;
  };

  if (!agentId || !message) {
    return NextResponse.json(
      { error: "agentId and message are required" },
      { status: 400 }
    );
  }

  const agent = await getAgent(agentId);
  if (!agent || agent.company_id !== auth.companyId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const conv = await createConversation(agentId, message.slice(0, 60));
    convId = conv.id;
  } else {
    const existing = await getConversation(convId);
    if (!existing) {
      const conv = await createConversation(agentId, message.slice(0, 60));
      convId = conv.id;
    }
  }

  // Save user message
  await addMessage({ conversation_id: convId, role: "user", content: message });

  // Load context
  const history = await getMessages(convId, 50);
  const apiMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const memories = await getMemory(agentId);
  let memorySection = "";
  if (memories.length > 0) {
    memorySection =
      "\n\n## What You Remember\n" +
      memories.map((m) => `- **${m.key}:** ${m.value}`).join("\n");
  }

  // Closed-loop learning: surface recent lessons from prior runs
  let lessonsSection = "";
  try {
    const lessons = await buildLessonsHelper({
      firmId: agent.company_id,
      agentId,
    }).readRecent({ limit: 5 });
    if (lessons.length > 0) {
      lessonsSection =
        "\n\n## Recent Lessons\nApply these when relevant. Each is a real outcome from a prior run.\n" +
        lessons
          .map((l) => {
            const outcome = l.outputAccepted === "approved"
              ? "approved"
              : l.outputAccepted === "rejected"
              ? "rejected"
              : l.outputAccepted === "modified"
              ? "modified by the user"
              : "outcome unknown";
            const mod = l.modificationDetail ? ` — change: ${l.modificationDetail}` : "";
            const crit = l.selfCritique ? ` — note: ${l.selfCritique}` : "";
            return `- ${l.taskDescription} (${outcome})${mod}${crit}`;
          })
          .join("\n");
    }
  } catch (err) {
    console.warn("[v1/chat] lesson lookup failed; continuing without:", err);
  }

  // Open a run record. Postgres-only — returns null in dev (no DATABASE_URL)
  // and we fall back to a transient id so the lesson write below still has
  // a stable foreign-key-shaped value.
  const runRecord = await createAgentRun({
    companyId: auth.companyId,
    agentRole: agent.role,
    agentId,
    triggeredBy: "api",
    triggerDetail: `POST /api/v1/chat · conversation ${convId}`,
    input: { conversationId: convId, message },
  });
  const runId = runRecord?.id ?? `run_tmp_${randomUUID()}`;

  // Route through the LLM router so tenants on BYOM (OpenAI / OpenAI-compat /
  // their own Anthropic key) hit the right provider. Falls back to env-level
  // Anthropic if no per-tenant LLM key is configured.
  const llmConfig = await getLLMConfigForCompany(auth.companyId);
  let completion;
  try {
    completion = await createCompletion(
      auth.companyId,
      {
        system: agent.system_prompt + memorySection + lessonsSection,
        messages: apiMessages,
        maxTokens: 4096,
      },
      llmConfig
    );
  } catch (err) {
    await completeAgentRun(runId, {
      status: "failed",
      errorDetail: err instanceof Error ? err.message : String(err),
      modelUsed: llmConfig.model,
      provider: llmConfig.provider,
    });
    throw err;
  }
  const responseText = completion.text;

  // Save assistant response
  await addMessage({
    conversation_id: convId,
    role: "assistant",
    content: responseText,
  });

  // Track usage
  await incrementUsage(auth.companyId, "message_count");

  // Detect @mentions and fire inter-agent relays. Failures here never block
  // the response — they're logged and reported per-mention.
  const mentions = await dispatchMentions({
    fromAgentId: agentId,
    conversationId: convId,
    content: responseText,
  });

  // Close the run record with usage + output snapshot. Fire-and-forget — if
  // the DB hiccups we still return the response.
  await completeAgentRun(runId, {
    status: "completed",
    output: { response: responseText, mentionsDispatched: mentions.length },
    modelUsed: completion.model,
    provider: completion.provider,
    tokensIn: completion.usage.input_tokens,
    tokensOut: completion.usage.output_tokens,
    summary: responseText.slice(0, 200),
  });

  // Close the closed loop: write a lesson with outputAccepted=unknown.
  // Future approve/reject UI flips this to approved/rejected/modified and
  // attaches modificationDetail so the next run reads richer context.
  try {
    await buildLessonsHelper({
      firmId: auth.companyId,
      agentId,
    }).write({
      agentId,
      runId,
      taskDescription: message.slice(0, 200),
      outputAccepted: "unknown",
    });
  } catch (err) {
    console.warn("[v1/chat] lesson write failed; continuing:", err);
  }

  return NextResponse.json({
    conversationId: convId,
    response: responseText,
    runId,
    model: completion.model,
    provider: completion.provider,
    byom: llmConfig.byom,
    usage: completion.usage,
    ...(mentions.length > 0 ? { mentions } : {}),
  });
}
