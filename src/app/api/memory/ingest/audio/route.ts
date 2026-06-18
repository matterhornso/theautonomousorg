/**
 * POST /api/memory/ingest/audio
 *
 * Body: {
 *   audioUrl: string,                // publicly fetchable URL
 *   companyId?: string,              // required when called with x-internal-secret
 *   kind?: 'meeting' | 'call' | ...  // default 'meeting'
 *   title?: string,
 *   occurredAt?: string,
 *   source?: string,                 // 'deepgram' | 'zoom' | 'fireflies' | ...
 *   sourceRef?: string,
 *   language?: string,               // BCP-47 hint; otherwise auto-detect
 *   metadata?: Record<string, unknown>
 * }
 *
 * Chains Deepgram transcription → entity-extractor → knowledge graph.
 *
 * Returns: {
 *   transcript: string,
 *   durationSec?: number,
 *   conversationId: string | null,
 *   personIds: string[], decisionIds: string[], commitmentIds: string[],
 *   edgesCreated: number,
 *   llmRan: boolean
 * }
 *
 * Auth: Clerk session OR x-internal-secret (for Zoom/Fireflies webhooks).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import {
  isDeepgramConfigured,
  transcribeAudioFromUrl,
} from "@/lib/deepgram";
import { ingestConversation } from "@/lib/entity-extractor";
import type { ConversationKind } from "@/lib/knowledge-graph";
import { safeSecretEqual, isPubliclyFetchableHttpUrl } from "@/lib/request-guards";

const VALID_KINDS: ConversationKind[] = [
  "meeting",
  "call",
  "email_thread",
  "chat",
  "agent_run",
  "note",
];

export async function POST(request: NextRequest) {
  if (!isDeepgramConfigured()) {
    return NextResponse.json(
      { error: "Deepgram not configured — set DEEPGRAM_API_KEY" },
      { status: 503 }
    );
  }

  const internalSecret = request.headers.get("x-internal-secret");
  const isInternal = safeSecretEqual(internalSecret, process.env.INTERNAL_SECRET);

  let body: {
    audioUrl?: string;
    companyId?: string;
    kind?: string;
    title?: string;
    occurredAt?: string;
    source?: string;
    sourceRef?: string;
    language?: string;
    metadata?: Record<string, unknown>;
    /** "private" keeps the recording (and its extracted entities) out of the
     *  shared brain — visible only to its owner. Defaults to "company". */
    visibility?: string;
    /** Owner for an internal-call private capture. Clerk calls use the user. */
    ownerUserId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.audioUrl || typeof body.audioUrl !== "string") {
    return NextResponse.json(
      { error: "audioUrl is required" },
      { status: 400 }
    );
  }
  // SSRF guard: Deepgram fetches this URL server-side, so reject non-public /
  // internal / non-https targets (cloud metadata, internal services).
  if (!isPubliclyFetchableHttpUrl(body.audioUrl)) {
    return NextResponse.json(
      { error: "audioUrl must be a public https URL" },
      { status: 400 }
    );
  }

  // Resolve tenant + acting user (for private captures).
  let companyId: string;
  let actingUserId: string | undefined;
  if (isInternal) {
    if (!body.companyId) {
      return NextResponse.json(
        { error: "companyId required for internal calls" },
        { status: 400 }
      );
    }
    companyId = body.companyId;
    actingUserId = body.ownerUserId;
  } else {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    actingUserId = session.userId;
    const tenant = await resolveTenant();
    companyId = tenant.firm.id;
  }

  const visibility: "company" | "private" =
    body.visibility === "private" ? "private" : "company";
  if (visibility === "private" && !actingUserId) {
    return NextResponse.json(
      { error: "ownerUserId required for a private capture" },
      { status: 400 }
    );
  }

  // Transcribe
  let transcript;
  try {
    transcript = await transcribeAudioFromUrl(body.audioUrl, {
      language: body.language,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
  if (!transcript || !transcript.transcript) {
    return NextResponse.json(
      { error: "Deepgram returned an empty transcript" },
      { status: 422 }
    );
  }

  // Ingest into the graph
  const kind: ConversationKind =
    body.kind && VALID_KINDS.includes(body.kind as ConversationKind)
      ? (body.kind as ConversationKind)
      : "meeting";
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : undefined;
  const result = await ingestConversation({
    companyId,
    text: transcript.transcript,
    kind,
    title: body.title,
    occurredAt,
    source: body.source ?? "deepgram",
    sourceRef: body.sourceRef,
    metadata: {
      ...(body.metadata ?? {}),
      audioUrl: body.audioUrl,
      transcriptionModel: transcript.model,
      durationSec: transcript.durationSec,
      detectedLanguage: transcript.language,
    },
    visibility,
    ownerUserId: visibility === "private" ? actingUserId : undefined,
  });

  return NextResponse.json({
    transcript: transcript.transcript,
    durationSec: transcript.durationSec,
    conversationId: result.conversation?.id ?? null,
    personIds: result.personIds,
    decisionIds: result.decisionIds,
    commitmentIds: result.commitmentIds,
    edgesCreated: result.edgesCreated,
    llmRan: result.llmRan,
  });
}
