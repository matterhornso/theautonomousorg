/**
 * POST /api/memory/ingest/audio-upload   (multipart/form-data)
 *
 * The browser front door for in-app voice capture. The sibling route
 * `/api/memory/ingest/audio` only accepts a publicly-fetchable `audioUrl`
 * (for Zoom/Fireflies webhooks); a `MediaRecorder` blob has no public URL, so
 * this route takes the raw bytes and runs them through Deepgram's buffer path
 * (`transcribeAudioFromBuffer`) before the existing entity-extraction pipeline.
 *
 * Form fields:
 *   audio       File    (required) — the recorded/uploaded clip
 *   title       string  (optional)
 *   language    string  (optional) — BCP-47 hint; otherwise auto-detect
 *   kind        string  (optional) — default 'meeting'
 *   visibility  string  (optional) — 'company' (default) | 'private'
 *
 * Auth: Clerk session only. A "private" capture is owned by the signed-in user;
 * that lane keeps it out of the shared brain (agents read with no viewer →
 * company-only). This is the UI front door for the Phase 1 visibility feature.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import {
  isDeepgramConfigured,
  transcribeAudioFromBuffer,
} from "@/lib/deepgram";
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

const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

// Transcription + entity extraction can exceed the platform default budget.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isDeepgramConfigured()) {
    return NextResponse.json(
      { error: "Deepgram not configured — set DEEPGRAM_API_KEY" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reject oversized bodies before buffering (cheap DoS guard).
  const declaredLen = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BYTES) {
    return NextResponse.json(
      { error: `body exceeds ${MAX_BYTES / (1024 * 1024)}MB limit` },
      { status: 413 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: "audio file is required" },
      { status: 400 }
    );
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `audio exceeds ${MAX_BYTES / (1024 * 1024)}MB limit` },
      { status: 413 }
    );
  }

  const title = (form.get("title") as string | null)?.trim() || undefined;
  const language = (form.get("language") as string | null)?.trim() || undefined;
  const kindRaw = (form.get("kind") as string | null)?.trim();
  const kind: ConversationKind =
    kindRaw && VALID_KINDS.includes(kindRaw as ConversationKind)
      ? (kindRaw as ConversationKind)
      : "meeting";
  const visibility: "company" | "private" =
    form.get("visibility") === "private" ? "private" : "company";

  const tenant = await resolveTenant();
  const companyId = tenant.firm.id;

  // Transcribe the raw bytes (no public URL needed).
  let transcript;
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    transcript = await transcribeAudioFromBuffer(
      bytes,
      audio.type || "audio/webm",
      { language }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
  if (!transcript || !transcript.transcript.trim()) {
    return NextResponse.json(
      { error: "Deepgram returned an empty transcript" },
      { status: 422 }
    );
  }

  const result = await ingestConversation({
    companyId,
    text: transcript.transcript,
    kind,
    title,
    source: "deepgram",
    metadata: {
      capture: "in_app_recording",
      contentType: audio.type || null,
      transcriptionModel: transcript.model,
      durationSec: transcript.durationSec,
      detectedLanguage: transcript.language,
    },
    visibility,
    ownerUserId: visibility === "private" ? session.userId : undefined,
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
    visibility,
  });
}
