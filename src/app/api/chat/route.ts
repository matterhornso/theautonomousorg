import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import {
  getAgent,
  getMessages,
  addMessage,
  createConversation,
  getConversation,
  getMemory,
  setMemory,
  getAgentsByCompany,
  hasEnoughCredits,
  deductCredits,
  CREDITS_PER_PROMPT,
  getFileUpload,
} from "@/lib/db";
import fs from "fs";
import pathModule from "path";
import {
  isApolloConfigured,
  apolloTools,
  executeApolloTool,
} from "@/lib/mcp/apollo";
import { ceoTools, executeCeoTool } from "@/lib/mcp/ceo-tools";

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

    const { userId } = await auth();

    // Rate limit
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const rl = checkRateLimit(getRateLimitKey("chat", userId || ip), RATE_LIMITS.chat);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many messages. Please wait a moment." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check credits
    if (userId && !hasEnoughCredits(userId)) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits. You need " + CREDITS_PER_PROMPT + " credits per message. Top up your credits to continue.",
          code: "INSUFFICIENT_CREDITS",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
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

    // Check for uploaded file references in the user message and build file context
    let fileContext = "";
    const fileUrlPattern = /\/api\/upload\/([a-f0-9-]{36})/g;
    const fileMatches = message.matchAll(fileUrlPattern);
    for (const match of fileMatches) {
      const fileId = match[1];
      const upload = getFileUpload(fileId);
      if (upload) {
        const isTextFile = ["text/plain", "text/csv"].includes(upload.file_type);
        const isImage = upload.file_type.startsWith("image/");
        const isPdf = upload.file_type === "application/pdf";

        if (isTextFile) {
          try {
            const filePath = pathModule.join(process.cwd(), "data", "uploads", upload.file_path);
            const content = fs.readFileSync(filePath, "utf-8");
            const truncated = content.length > 50000 ? content.slice(0, 50000) + "\n\n[...truncated, file too large to show in full]" : content;
            fileContext += `\n\n--- Uploaded File: ${upload.file_name} (${upload.file_type}, ${(upload.file_size / 1024).toFixed(1)}KB) ---\n${truncated}\n--- End of File ---`;
          } catch {
            fileContext += `\n\n[File uploaded: ${upload.file_name} (${upload.file_type}) — could not read contents]`;
          }
        } else if (isPdf) {
          fileContext += `\n\n[PDF uploaded: ${upload.file_name} (${(upload.file_size / 1024).toFixed(1)}KB) — PDF contents cannot be read inline, but the file is available at /api/upload/${fileId}]`;
        } else if (isImage) {
          fileContext += `\n\n[Image uploaded: ${upload.file_name} (${upload.file_type}, ${(upload.file_size / 1024).toFixed(1)}KB) — available at /api/upload/${fileId}]`;
        } else {
          fileContext += `\n\n[File uploaded: ${upload.file_name} (${upload.file_type}, ${(upload.file_size / 1024).toFixed(1)}KB) — available at /api/upload/${fileId}]`;
        }
      }
    }

    // If file context was found, append it to the last user message in apiMessages
    if (fileContext && apiMessages.length > 0) {
      const lastIdx = apiMessages.length - 1;
      if (apiMessages[lastIdx].role === "user") {
        apiMessages[lastIdx] = {
          ...apiMessages[lastIdx],
          content: apiMessages[lastIdx].content + fileContext,
        };
      }
    }

    // Load agent memory
    const memories = getMemory(agentId);
    let memorySection = "";
    if (memories.length > 0) {
      memorySection =
        "\n\n## What You Remember\n" +
        memories.map((m) => `- **${m.key}:** ${m.value}`).join("\n");
    }

    const systemPrompt = agent.system_prompt + memorySection;

    // Determine available tools for this agent
    const tools: Anthropic.Tool[] = [];
    if (isApolloConfigured() && ["Sales", "Strategy"].includes(agent.role)) {
      tools.push(...apolloTools as Anthropic.Tool[]);
    }
    if (agent.role === "CEO") {
      tools.push(...ceoTools);
    }

    // Stream response (with tool use if tools available)
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
      ...(tools.length > 0 ? { tools } : {}),
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

          const toolCalls: { id: string; name: string; input: Record<string, unknown> }[] = [];

          let inToolBlock = false;

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;

              // Filter out tool call markup that Claude sometimes outputs as text
              if (text.includes("<tool_call>") || text.includes("<tool_response>")) {
                inToolBlock = true;
              }
              if (inToolBlock) {
                if (text.includes("</tool_response>")) {
                  inToolBlock = false;
                }
                fullResponse += text; // Still save for context but don't show
                continue; // Don't stream to user
              }

              // Skip raw JSON tool output patterns
              if (text.match(/^\s*\{"name":\s*"/) || text.match(/^\s*\{"arguments":/)) {
                continue;
              }

              fullResponse += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            } else if (
              event.type === "content_block_start" &&
              (event as unknown as { content_block: { type: string; id: string; name: string } }).content_block.type === "tool_use"
            ) {
              toolCalls.push({
                id: (event as unknown as { content_block: { type: string; id: string; name: string } }).content_block.id,
                name: (event as unknown as { content_block: { type: string; id: string; name: string } }).content_block.name,
                input: {} as Record<string, unknown>,
              });
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "input_json_delta"
            ) {
              // Tool input comes as JSON deltas — accumulate
              const lastTool = toolCalls[toolCalls.length - 1];
              if (lastTool) {
                // Will be parsed from the final message
              }
            }
          }

          // Handle tool calls if any
          if (toolCalls.length > 0) {
            const finalMessage = await stream.finalMessage();

            // Extract full tool inputs from final message
            for (const block of finalMessage.content) {
              if (block.type === "tool_use") {
                const tc = toolCalls.find((t) => t.id === block.id);
                if (tc) tc.input = block.input as Record<string, unknown>;
              }
            }

            // Execute each tool and send results
            for (const tc of toolCalls) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: `\n\n` })}\n\n`
                )
              );

              let result: string;
              if (tc.name.startsWith("apollo_")) {
                result = await executeApolloTool(tc.name, tc.input);
              } else if (tc.name === "query_all_agents" || tc.name === "get_company_metrics") {
                result = await executeCeoTool(tc.name, tc.input, agent.company_id);
              } else {
                result = `Unknown tool: ${tc.name}`;
              }
              fullResponse += `\n\n${result}`;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: result })}\n\n`)
              );
            }
          }

          // Clean tool markup from response before saving
          const cleanResponse = fullResponse
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
            .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

          // Save assistant response
          addMessage({
            conversation_id: convId!,
            role: "assistant",
            content: cleanResponse || fullResponse,
          });

          // Deduct credits
          if (userId) {
            const result = deductCredits(
              userId,
              CREDITS_PER_PROMPT,
              `Chat with ${agent.role} Agent`
            );
            // Send remaining balance to client
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ credits: { balance: result.balance, cost: CREDITS_PER_PROMPT } })}\n\n`
              )
            );
          }

          // Extract memory every 5 messages
          const messageCount = getMessages(convId!, 100).length;
          if (messageCount % 10 === 0 && messageCount > 0) {
            extractMemory(agentId, message, fullResponse);
          }

          // Check for inter-agent mentions and actually relay
          const mentions = fullResponse.match(/@(\w[\w\s-]*?)(?=[\s,.\n!?]|$)/g);
          if (mentions && mentions.length > 0) {
            const agents = getAgentsByCompany(agent.company_id);
            const processed = new Set<string>();
            for (const mention of mentions.slice(0, 2)) {
              const mentionedRole = mention.slice(1).trim();
              if (processed.has(mentionedRole.toLowerCase())) continue;
              processed.add(mentionedRole.toLowerCase());

              const mentionedAgent = agents.find(
                (a) =>
                  a.role.toLowerCase() === mentionedRole.toLowerCase() &&
                  a.id !== agentId
              );
              if (mentionedAgent) {
                // Notify user that relay is happening
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      interAgent: {
                        from: agent.role,
                        to: mentionedAgent.role,
                        agentId: mentionedAgent.id,
                        status: "relaying",
                      },
                    })}\n\n`
                  )
                );

                // Actually relay the message
                try {
                  const relayRes = await fetch(
                    `${request.nextUrl.origin}/api/agents/relay`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sourceAgentId: agentId,
                        targetRole: mentionedRole,
                        message: fullResponse,
                        conversationId: convId,
                        depth: 0,
                      }),
                    }
                  );
                  const relayData = await relayRes.json();
                  if (relayData.response) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          relay: {
                            from: mentionedAgent.role,
                            response: relayData.response,
                          },
                        })}\n\n`
                      )
                    );
                  }
                } catch {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        relay: {
                          from: mentionedAgent.role,
                          response: `@${mentionedAgent.role} is unavailable right now.`,
                        },
                      })}\n\n`
                    )
                  );
                }
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
