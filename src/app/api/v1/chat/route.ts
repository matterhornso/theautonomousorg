import Anthropic from "@anthropic-ai/sdk";
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

const client = new Anthropic();

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

  // Call Claude (non-streaming for API simplicity)
  const result = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: agent.system_prompt + memorySection + lessonsSection,
    messages: apiMessages,
  });

  const responseText =
    result.content[0].type === "text" ? result.content[0].text : "";

  // Save assistant response
  await addMessage({
    conversation_id: convId,
    role: "assistant",
    content: responseText,
  });

  // Track usage
  await incrementUsage(auth.companyId, "message_count");

  return NextResponse.json({
    conversationId: convId,
    response: responseText,
    model: "claude-sonnet-4-6",
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    },
  });
}
