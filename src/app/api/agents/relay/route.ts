import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assertCompanyOwnership } from "@/lib/auth-helpers";
import {
  getAgent,
  getAgentsByCompany,
  getMemory,
  createInterAgentMessage,
  completeInterAgentMessage,
  addMessage,
} from "@/lib/db";
import { createAgentRun, completeAgentRun } from "@/lib/agent-runs";
import { buildLessonsHelper } from "@/lib/lessons";
import { randomUUID } from "crypto";

const client = new Anthropic();
const MAX_DEPTH = 3;

export async function POST(request: NextRequest) {
  try {
    // Allow internal calls via secret header, or require auth
    const internalSecret = request.headers.get("x-internal-secret");
    const isInternalCall = internalSecret && process.env.INTERNAL_SECRET && internalSecret === process.env.INTERNAL_SECRET;

    if (!isInternalCall) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Ownership is verified after we read sourceAgentId below
      // (we store userId for the ownership check)
      (request as unknown as Record<string, string>).__userId = userId;
    }

    const { sourceAgentId, targetRole, message, conversationId, depth = 0 } =
      (await request.json()) as {
        sourceAgentId: string;
        targetRole: string;
        message: string;
        conversationId?: string;
        depth?: number;
      };

    // Guard: max depth
    if (depth >= MAX_DEPTH) {
      return NextResponse.json({
        response:
          "I can't relay this message — the inter-agent communication chain is too deep. Please handle this directly.",
        status: "depth_exceeded",
      });
    }

    const sourceAgent = await getAgent(sourceAgentId);
    if (!sourceAgent) {
      return NextResponse.json(
        { error: "Source agent not found" },
        { status: 404 }
      );
    }

    // Verify ownership if not an internal call
    const storedUserId = (request as unknown as Record<string, string>).__userId;
    if (storedUserId) {
      const ownership = await assertCompanyOwnership(storedUserId, sourceAgent.company_id);
      if (!ownership.ok) {
        return ownership.response;
      }
    }

    // Find target agent in the same company
    const companyAgents = await getAgentsByCompany(sourceAgent.company_id);
    const targetAgent = companyAgents.find(
      (a) => a.role.toLowerCase() === targetRole.toLowerCase() && a.id !== sourceAgentId
    );

    if (!targetAgent) {
      return NextResponse.json({
        response: `@${targetRole} agent is not available for this company.`,
        status: "not_found",
      });
    }

    // Create inter-agent message record
    const iam = await createInterAgentMessage({
      source_agent_id: sourceAgentId,
      target_agent_id: targetAgent.id,
      request: message,
      conversation_id: conversationId,
    });

    // Open an agent_runs row for the target agent — relays flow into the
    // same run+lesson surface as chat completions so cross-agent learning
    // shows up in /admin/agents and the closed loop.
    const runRecord = await createAgentRun({
      companyId: sourceAgent.company_id,
      agentRole: targetAgent.role,
      agentId: targetAgent.id,
      triggeredBy: "mention",
      triggerDetail: `@${sourceAgent.role} → @${targetAgent.role}`,
      input: { sourceAgentId, sourceRole: sourceAgent.role, message, conversationId, depth },
    });
    const runId = runRecord?.id ?? `run_tmp_${randomUUID()}`;

    // Load target agent's memory + recent lessons (closed-loop learning).
    const memories = await getMemory(targetAgent.id);
    let memorySection = "";
    if (memories.length > 0) {
      memorySection =
        "\n\n## What You Remember\n" +
        memories.map((m) => `- **${m.key}:** [${m.value.replace(/[[\]]/g, '')}]`).join("\n");
    }
    let lessonsSection = "";
    try {
      const lessons = await buildLessonsHelper({
        firmId: sourceAgent.company_id,
        agentId: targetAgent.id,
      }).readRecent({ limit: 5 });
      if (lessons.length > 0) {
        lessonsSection =
          "\n\n## Recent Lessons\nApply when relevant.\n" +
          lessons
            .map((l) => `- ${l.taskDescription} (${l.outputAccepted})`)
            .join("\n");
      }
    } catch {
      /* dev mode without DB — quietly continue */
    }

    // Call Claude as the target agent
    let result;
    try {
      result = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: targetAgent.system_prompt + memorySection + lessonsSection,
        messages: [
          {
            role: "user",
            content: `[Inter-agent request from @${sourceAgent.role}]\n\n${message}`,
          },
        ],
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

    const responseText =
      result.content[0].type === "text" ? result.content[0].text : "";

    // Complete the inter-agent message
    await completeInterAgentMessage(iam.id, responseText);

    // Add the relay as a system message in the conversation
    if (conversationId) {
      await addMessage({
        conversation_id: conversationId,
        role: "system",
        content: `[@${targetAgent.role} responded to @${sourceAgent.role}]: ${responseText}`,
      });
    }

    // Close the run + write a lesson with outputAccepted=unknown so the
    // target agent learns from this cross-agent interaction. POST
    // /api/agents/runs/[runId]/feedback flips this to approved/rejected/
    // modified once a human (or the source agent) signals.
    await completeAgentRun(runId, {
      status: "completed",
      output: { response: responseText, sourceAgentId, sourceRole: sourceAgent.role },
      modelUsed: "claude-sonnet-4-6",
      provider: "anthropic",
      tokensIn: result.usage?.input_tokens,
      tokensOut: result.usage?.output_tokens,
      summary: responseText.slice(0, 200),
    });
    try {
      await buildLessonsHelper({
        firmId: sourceAgent.company_id,
        agentId: targetAgent.id,
      }).write({
        agentId: targetAgent.id,
        runId,
        taskDescription: `Inter-agent from @${sourceAgent.role}: ${message.slice(0, 160)}`,
        outputAccepted: "unknown",
      });
    } catch {
      /* dev mode without DB — quietly continue */
    }

    return NextResponse.json({
      response: responseText,
      targetRole: targetAgent.role,
      runId,
      status: "done",
    });
  } catch (error) {
    console.error("Relay error:", error);
    return NextResponse.json(
      { error: "Inter-agent relay failed" },
      { status: 500 }
    );
  }
}
