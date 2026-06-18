/**
 * POST /api/recorder/ingest
 *
 * The device-ingest webhook for The Autonomous Recorder (and the OEM cloud that
 * forwards recordings). Authenticated by a scoped per-workspace device key in
 * the `X-TA-Api-Key` header — NOT the cross-service INTERNAL_SECRET. The key
 * resolves the owning company; see migration 012 + src/lib/recorder-keys.ts.
 *
 * Two body shapes:
 *   multipart/form-data:
 *     audio        File    (required) the recording
 *     recordingId  string  (required) stable id → dedup key (conversations.source_ref)
 *     deviceId     string  (optional)
 *     startedAt    string  (optional) ISO-8601 — when the recording began
 *     durationSec  string  (optional)
 *     language     string  (optional) BCP-47 hint, else auto-detect
 *     speakerCount string  (optional)
 *     title        string  (optional)
 *   application/json:
 *     { recordingId, audioUrl, deviceId?, startedAt?, durationSec?, language?,
 *       speakerCount?, title? }   — audioUrl must be fetchable by us
 *
 * Idempotent on (company, source="recorder", recordingId): re-delivery returns
 * 200 { status: "duplicate" } without re-ingesting.
 *
 * Returns: 200 { conversationId, status: "accepted" | "duplicate" }
 *
 * The audio is transcribed by Deepgram and entity-extracted into the company
 * knowledge graph (the same pipeline as every other ingestion source). Device
 * captures land in the shared company lane, so agents read them via
 * helpers.memory.recall().
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isDeepgramConfigured,
  transcribeAudioFromUrl,
  transcribeAudioFromBuffer,
} from "@/lib/deepgram";
import { isPubliclyFetchableHttpUrl } from "@/lib/request-guards";
import { ingestConversation } from "@/lib/entity-extractor";
import { existingConversationSourceRefs } from "@/lib/knowledge-graph";
import { resolveCompanyByRecorderKey } from "@/lib/recorder-keys";
import type { TranscriptionResult } from "@/lib/deepgram";

const SOURCE = "recorder";
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

// Transcription + extraction can exceed the platform default budget.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // ── Auth first: a bad/missing key learns nothing about our config ──────────
  const apiKey = request.headers.get("x-ta-api-key");
  const resolved = await resolveCompanyByRecorderKey(apiKey);
  if (!resolved) {
    return NextResponse.json(
      { error: "invalid or missing X-TA-Api-Key" },
      { status: 401 }
    );
  }
  const companyId = resolved.companyId;

  if (!isDeepgramConfigured()) {
    return NextResponse.json(
      { error: "Deepgram not configured — set DEEPGRAM_API_KEY" },
      { status: 503 }
    );
  }

  // Reject oversized bodies before buffering them (cheap DoS guard; the precise
  // per-file cap is still enforced after parsing).
  const declaredLen = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BYTES) {
    return NextResponse.json(
      { error: `body exceeds ${MAX_BYTES / (1024 * 1024)}MB limit` },
      { status: 413 }
    );
  }

  // ── Parse body (multipart audio bytes, or JSON audioUrl) ───────────────────
  const contentTypeHeader = request.headers.get("content-type") ?? "";
  let recordingId: string | undefined;
  let deviceId: string | undefined;
  let startedAt: string | undefined;
  let durationSec: number | undefined;
  let language: string | undefined;
  let speakerCount: number | undefined;
  let title: string | undefined;
  let audioBytes: Uint8Array | undefined;
  let audioContentType = "audio/mpeg";
  let audioUrl: string | undefined;

  try {
    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await request.formData();
      const audio = form.get("audio");
      if (!(audio instanceof File) || audio.size === 0) {
        return NextResponse.json({ error: "audio file is required" }, { status: 400 });
      }
      if (audio.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `audio exceeds ${MAX_BYTES / (1024 * 1024)}MB limit` },
          { status: 413 }
        );
      }
      audioBytes = new Uint8Array(await audio.arrayBuffer());
      audioContentType = audio.type || "audio/mpeg";
      recordingId = (form.get("recordingId") as string | null)?.trim() || undefined;
      deviceId = (form.get("deviceId") as string | null)?.trim() || undefined;
      startedAt = (form.get("startedAt") as string | null)?.trim() || undefined;
      title = (form.get("title") as string | null)?.trim() || undefined;
      language = (form.get("language") as string | null)?.trim() || undefined;
      durationSec = numberOrUndefined(form.get("durationSec"));
      speakerCount = numberOrUndefined(form.get("speakerCount"));
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      recordingId = str(body.recordingId);
      audioUrl = str(body.audioUrl);
      deviceId = str(body.deviceId);
      startedAt = str(body.startedAt);
      title = str(body.title);
      language = str(body.language);
      durationSec = numberOrUndefined(body.durationSec);
      speakerCount = numberOrUndefined(body.speakerCount);
      if (!audioUrl) {
        return NextResponse.json(
          { error: "audioUrl is required for JSON requests" },
          { status: 400 }
        );
      }
    }
  } catch {
    return NextResponse.json({ error: "could not parse request body" }, { status: 400 });
  }

  if (!recordingId) {
    return NextResponse.json({ error: "recordingId is required" }, { status: 400 });
  }
  // Cap recordingId length (it becomes source_ref); avoids oversized keys.
  if (recordingId.length > 512) {
    return NextResponse.json({ error: "recordingId too long" }, { status: 400 });
  }
  // SSRF guard on the JSON audioUrl path (Deepgram fetches it server-side).
  if (audioUrl && !isPubliclyFetchableHttpUrl(audioUrl)) {
    return NextResponse.json(
      { error: "audioUrl must be a public https URL" },
      { status: 400 }
    );
  }

  // ── Idempotency: re-delivery of the same recording is a no-op ───────────────
  const seen = await existingConversationSourceRefs(companyId, SOURCE, [recordingId]);
  if (seen.has(recordingId)) {
    return NextResponse.json({ conversationId: null, status: "duplicate" });
  }

  // ── Transcribe ─────────────────────────────────────────────────────────────
  let transcript: TranscriptionResult | null;
  try {
    transcript = audioBytes
      ? await transcribeAudioFromBuffer(audioBytes, audioContentType, { language })
      : await transcribeAudioFromUrl(audioUrl as string, { language });
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

  // ── Ingest into the company brain (shared lane) ────────────────────────────
  const occurredAt = startedAt ? new Date(startedAt) : undefined;
  const result = await ingestConversation({
    companyId,
    text: transcript.transcript,
    kind: "meeting",
    title,
    occurredAt:
      occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : undefined,
    source: SOURCE,
    sourceRef: recordingId,
    metadata: {
      capture: "recorder_webhook",
      deviceId: deviceId ?? null,
      durationSec: durationSec ?? transcript.durationSec ?? null,
      speakerCount: speakerCount ?? null,
      transcriptionModel: transcript.model,
      detectedLanguage: transcript.language,
    },
    visibility: "company",
  });

  return NextResponse.json({
    conversationId: result.conversation?.id ?? null,
    status: "accepted",
  });
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function numberOrUndefined(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
