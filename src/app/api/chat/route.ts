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
  getCompany,
  hasEnoughCredits,
  deductCredits,
  CREDITS_PER_PROMPT,
  getFileUpload,
  logAgentAction,
  createEval,
} from "@/lib/db";
import { judgeResponse } from "@/lib/eval-judge";
import fs from "fs";
import pathModule from "path";
import {
  isApolloConfigured,
  apolloTools,
  executeApolloTool,
} from "@/lib/mcp/apollo";
import { ceoTools, executeCeoTool } from "@/lib/mcp/ceo-tools";
import { buildLessonsHelper } from "@/lib/lessons";
import { extractMentions } from "@/lib/mention-dispatch";

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
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Sign in to chat with agents" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

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
    if (userId && !(await hasEnoughCredits(userId))) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits. You need " + CREDITS_PER_PROMPT + " credits per message. Top up your credits to continue.",
          code: "INSUFFICIENT_CREDITS",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const agent = await getAgent(agentId);
    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
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

    // Load conversation history (last 50 messages)
    const history = await getMessages(convId, 50);
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
      const upload = await getFileUpload(fileId);
      if (upload) {
        const isTextFile = ["text/plain", "text/csv"].includes(upload.file_type);
        const isImage = upload.file_type.startsWith("image/");
        const isPdf = upload.file_type === "application/pdf";

        if (isTextFile) {
          try {
            const uploadDir = pathModule.join(process.cwd(), "data", "uploads");
            const filePath = pathModule.join(uploadDir, upload.file_path);
            // Path traversal protection
            const resolved = pathModule.resolve(filePath);
            if (!resolved.startsWith(pathModule.resolve(uploadDir))) {
              fileContext += `\n\n[File uploaded: ${upload.file_name} — invalid file path]`;
              continue;
            }
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
    const memories = await getMemory(agentId);
    let memorySection = "";
    if (memories.length > 0) {
      memorySection =
        "\n\n## What You Remember\n" +
        memories.map((m) => `- **${m.key}:** [${m.value.replace(/[[\]]/g, '')}]`).join("\n");
    }

    // Load recent lessons (closed-loop learning — every run starts smarter than the last)
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
      console.warn("[chat] lesson lookup failed; continuing without:", err);
    }

    const systemPrompt = agent.system_prompt + memorySection + lessonsSection;

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

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              let text = event.delta.text;

              // Strip any <tool_call>/<tool_response> XML that leaks into text
              text = text.replace(/<\/?tool_call>/g, "")
                .replace(/<\/?tool_response>/g, "");

              // Skip if nothing left after stripping
              if (!text || /^\s*\{.*"name"\s*:/.test(text.trim())) continue;
              // Skip raw JSON tool inputs/outputs that leak
              if (text.trim().startsWith('{"') && text.includes('"name"')) continue;

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
              // Tool input JSON deltas — parsed from final message
            }
          }

          // Handle tool calls: execute tools and get a follow-up response from Claude
          if (toolCalls.length > 0) {
            const finalMessage = await stream.finalMessage();

            // Extract full tool inputs from final message
            for (const block of finalMessage.content) {
              if (block.type === "tool_use") {
                const tc = toolCalls.find((t) => t.id === block.id);
                if (tc) tc.input = block.input as Record<string, unknown>;
              }
            }

            // Execute each tool
            const toolResults: { tool_use_id: string; content: string }[] = [];
            for (const tc of toolCalls) {
              let result: string;
              if (tc.name.startsWith("apollo_")) {
                result = await executeApolloTool(tc.name, tc.input);
              } else if (tc.name === "query_all_agents" || tc.name === "get_company_metrics" || tc.name === "delegate_task") {
                result = await executeCeoTool(tc.name, tc.input, agent.company_id, convId);
              } else {
                result = `Tool ${tc.name} executed successfully.`;
              }
              toolResults.push({ tool_use_id: tc.id, content: result });
            }

            // Send tool results back to Claude for a natural language follow-up
            const followUpMessages = [
              ...apiMessages,
              { role: "assistant" as const, content: finalMessage.content },
              ...toolResults.map((tr) => ({
                role: "user" as const,
                content: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: tr.tool_use_id,
                    content: tr.content,
                  },
                ],
              })),
            ];

            // Stream the follow-up response
            const followUp = client.messages.stream({
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              system: systemPrompt,
              messages: followUpMessages,
              ...(tools.length > 0 ? { tools } : {}),
            });

            for await (const event of followUp) {
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
          }

          // Clean tool markup from response before saving
          const cleanResponse = fullResponse
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
            .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

          // Save assistant response
          await addMessage({
            conversation_id: convId!,
            role: "assistant",
            content: cleanResponse || fullResponse,
          });

          // Log action for activity feed
          await logAgentAction({
            agent_id: agentId,
            action_type: "chat_response",
            title: `Responded to: ${message.slice(0, 80)}${message.length > 80 ? "..." : ""}`,
            detail: (cleanResponse || fullResponse).slice(0, 200),
            source: "chat",
          });

          // Fire-and-forget eval (non-blocking)
          const evalResponse = cleanResponse || fullResponse;
          getCompany(agent.company_id).then((co) => {
            judgeResponse({
              agentRole: agent.role,
              companyName: co?.name || "Unknown",
              userMessage: message,
              agentResponse: evalResponse,
            }).then(async (result) => {
              await createEval({
                agent_id: agentId,
                conversation_id: convId!,
                eval_type: "response_quality",
                scores: JSON.stringify(result.scores),
                judge_reasoning: result.reasoning,
                prompt_used: message.slice(0, 500),
                response_evaluated: evalResponse.slice(0, 500),
              });
            }).catch(() => { /* eval is best-effort */ });
          }).catch(() => { /* eval is best-effort */ });

          // Deduct credits
          if (userId) {
            const result = await deductCredits(
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
          const messageCount = (await getMessages(convId!, 100)).length;
          if (messageCount % 10 === 0 && messageCount > 0) {
            extractMemory(agentId, message, fullResponse);
          }

          // Check for inter-agent mentions and actually relay
          // Uses the role-whitelist extractor so we don't fire phantom relays
          // on stray @-words, and the INTERNAL_SECRET header so server→server
          // calls to /api/agents/relay authenticate (cookies don't carry).
          const mentionedRoles = extractMentions(fullResponse).slice(0, 2);
          if (mentionedRoles.length > 0) {
            const agents = await getAgentsByCompany(agent.company_id);
            const internalSecret = process.env.INTERNAL_SECRET;
            const appUrl =
              process.env.APP_BASE_URL ??
              process.env.NEXT_PUBLIC_APP_URL ??
              "http://localhost:3000";

            for (const mentionedRole of mentionedRoles) {
              const mentionedAgent = agents.find(
                (a) =>
                  a.role.toLowerCase() === mentionedRole.toLowerCase() &&
                  a.id !== agentId
              );
              if (!mentionedAgent) continue;

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

              try {
                const relayRes = await fetch(`${appUrl}/api/agents/relay`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(internalSecret
                      ? { "x-internal-secret": internalSecret }
                      : {}),
                  },
                  body: JSON.stringify({
                    sourceAgentId: agentId,
                    targetRole: mentionedRole,
                    message: fullResponse,
                    conversationId: convId,
                    depth: 0,
                  }),
                });
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
          await setMemory(agentId, fact.key, fact.value);
        }
      }
    }
  } catch {
    // Memory extraction is best-effort, don't fail the chat
  }
}
