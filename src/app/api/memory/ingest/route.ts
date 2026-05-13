/**
 * POST /api/memory/ingest
 *
 * Body: {
 *   text: string,            // transcript / note / email body / any prose
 *   kind?: 'meeting' | 'call' | 'email_thread' | 'chat' | 'agent_run' | 'note',
 *   title?: string,
 *   occurredAt?: string,     // ISO datetime
 *   source?: string,         // 'deepgram' | 'gmail' | 'fireflies' | 'zoom' | 'manual'
 *   sourceRef?: string,      // External id from the source system
 *   metadata?: Record<string, unknown>
 * }
 *
 * Returns: {
 *   conversationId: string | null,
 *   personIds: string[],
 *   decisionIds: string[],
 *   commitmentIds: string[],
 *   edgesCreated: number,
 *   llmRan: boolean
 * }
 *
 * Auth: Clerk session OR x-internal-secret header (so an upstream
 * Deepgram/Zoom webhook can POST without a Clerk cookie).
 *
 * This is the writer that turns the empty v3 knowledge graph (migrations
 * 007 / 008) into a populated one. The /admin/memory page automatically
 * surfaces the new rows once they exist (queryCompanyMemory's "graph"
 * source).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import { ingestConversation } from "@/lib/entity-extractor";
import type { ConversationKind } from "@/lib/knowledge-graph";

const VALID_KINDS: ConversationKind[] = [
  "meeting",
  "call",
  "email_thread",
  "chat",
  "agent_run",
  "note",
];

export async function POST(request: NextRequest) {
  // Internal-secret bypass — Deepgram / Zoom webhooks call this with the
  // header and an explicit companyId in the body.
  const internalSecret = request.headers.get("x-internal-secret");
  const isInternal =
    internalSecret &&
    process.env.INTERNAL_SECRET &&
    internalSecret === process.env.INTERNAL_SECRET;

  let body: {
    text?: string;
    kind?: string;
    title?: string;
    occurredAt?: string;
    source?: string;
    sourceRef?: string;
    metadata?: Record<string, unknown>;
    companyId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400 }
    );
  }

  // Resolve companyId — either from the Clerk session's tenant or from the
  // request body when this is an internal call.
  let companyId: string;
  if (isInternal) {
    if (!body.companyId) {
      return NextResponse.json(
        { error: "companyId required for internal calls" },
        { status: 400 }
      );
    }
    companyId = body.companyId;
  } else {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenant = await resolveTenant();
    companyId = tenant.firm.id;
  }

  const kind: ConversationKind =
    body.kind && VALID_KINDS.includes(body.kind as ConversationKind)
      ? (body.kind as ConversationKind)
      : "note";

  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : undefined;
  if (occurredAt && Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json(
      { error: "occurredAt must be an ISO datetime" },
      { status: 400 }
    );
  }

  try {
    const result = await ingestConversation({
      companyId,
      text: body.text,
      kind,
      title: body.title,
      occurredAt,
      source: body.source,
      sourceRef: body.sourceRef,
      metadata: body.metadata,
    });

    return NextResponse.json({
      conversationId: result.conversation?.id ?? null,
      personIds: result.personIds,
      decisionIds: result.decisionIds,
      commitmentIds: result.commitmentIds,
      edgesCreated: result.edgesCreated,
      llmRan: result.llmRan,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
