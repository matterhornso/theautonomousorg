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

    // Load target agent's memory
    const memories = await getMemory(targetAgent.id);
    let memorySection = "";
    if (memories.length > 0) {
      memorySection =
        "\n\n## What You Remember\n" +
        memories.map((m) => `- **${m.key}:** [${m.value.replace(/[[\]]/g, '')}]`).join("\n");
    }

    // Call Claude as the target agent
    const result = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: targetAgent.system_prompt + memorySection,
      messages: [
        {
          role: "user",
          content: `[Inter-agent request from @${sourceAgent.role}]\n\n${message}`,
        },
      ],
    });

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

    return NextResponse.json({
      response: responseText,
      targetRole: targetAgent.role,
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
