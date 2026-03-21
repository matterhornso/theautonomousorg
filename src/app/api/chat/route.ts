import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import {
  getAgent,
  getMessages,
  addMessage,
  createConversation,
  getConversation,
  getMemory,
  setMemory,
  getAgentsByCompany,
} from "@/lib/db";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { agentId, conversationId, message } = (await request.json()) as {
      agentId: string;
      conversationId?: string;
      message: string;
    };

    if (!agentId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing agentId or message" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const agent = getAgent(agentId);
    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = createConversation(agentId, message.slice(0, 60));
      convId = conv.id;
    } else {
      const existing = getConversation(convId);
      if (!existing) {
        const conv = createConversation(agentId, message.slice(0, 60));
        convId = conv.id;
      }
    }

    // Save user message
    addMessage({ conversation_id: convId, role: "user", content: message });

    // Load conversation history (last 50 messages)
    const history = getMessages(convId, 50);
    const apiMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Load agent memory
    const memories = getMemory(agentId);
    let memorySection = "";
    if (memories.length > 0) {
      memorySection =
        "\n\n## What You Remember\n" +
        memories.map((m) => `- **${m.key}:** ${m.value}`).join("\n");
    }

    const systemPrompt = agent.system_prompt + memorySection;

    // Stream response
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send conversationId first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ conversationId: convId })}\n\n`
            )
          );

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }

          // Save assistant response
          addMessage({
            conversation_id: convId!,
            role: "assistant",
            content: fullResponse,
          });

          // Extract memory every 5 messages
          const messageCount = getMessages(convId!, 100).length;
          if (messageCount % 10 === 0 && messageCount > 0) {
            extractMemory(agentId, message, fullResponse);
          }

          // Check for inter-agent mentions
          const mentions = fullResponse.match(/@(\w[\w\s-]*?)(?=[\s,.\n!?]|$)/g);
          if (mentions && mentions.length > 0) {
            const agents = getAgentsByCompany(agent.company_id);
            for (const mention of mentions) {
              const mentionedRole = mention.slice(1).trim();
              const mentionedAgent = agents.find(
                (a) =>
                  a.role.toLowerCase() === mentionedRole.toLowerCase() &&
                  a.id !== agentId
              );
              if (mentionedAgent) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      interAgent: {
                        from: agent.role,
                        to: mentionedAgent.role,
                        agentId: mentionedAgent.id,
                      },
                    })}\n\n`
                  )
                );
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function extractMemory(
  agentId: string,
  userMessage: string,
  assistantResponse: string
) {
  try {
    const result = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "Extract 0-3 key facts worth remembering from this conversation exchange. Return a JSON array of {key, value} pairs where key is a short label and value is the fact. Return [] if nothing is noteworthy enough to remember long-term.",
      messages: [
        {
          role: "user",
          content: `User: ${userMessage}\n\nAssistant: ${assistantResponse.slice(0, 1000)}`,
        },
      ],
    });

    const text =
      result.content[0].type === "text" ? result.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const facts = JSON.parse(jsonMatch[0]) as {
        key: string;
        value: string;
      }[];
      for (const fact of facts.slice(0, 3)) {
        if (fact.key && fact.value) {
          setMemory(agentId, fact.key, fact.value);
        }
      }
    }
  } catch {
    // Memory extraction is best-effort, don't fail the chat
  }
}
