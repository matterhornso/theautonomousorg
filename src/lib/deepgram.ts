/**
 * Deepgram transcription wrapper — feeds the entity extractor.
 *
 * v1 scope: accept a remote audio URL and return a transcript. Live
 * streaming + word-level timestamps are out of scope; the entity extractor
 * only needs plain prose text.
 *
 * Degrades gracefully without DEEPGRAM_API_KEY → returns null so the
 * caller can render a sensible "configure Deepgram" message.
 *
 * Tests in test/deepgram.test.ts.
 */

const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";

export function isDeepgramConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

export interface TranscriptionResult {
  /** Concatenated transcript across all channels/utterances. */
  transcript: string;
  /** Top-line model name Deepgram used. */
  model: string;
  /** Duration of the audio in seconds, when Deepgram reports it. */
  durationSec?: number;
  /** Detected language (BCP-47), when Deepgram reports it. */
  language?: string;
}

interface DeepgramListenResponse {
  metadata?: {
    duration?: number;
    detected_language?: string;
    models?: Array<{ name?: string }>;
    model_info?: Record<string, { name?: string }>;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        languages?: string[];
      }>;
    }>;
    utterances?: Array<{ transcript?: string }>;
  };
}

export interface TranscribeOptions {
  /** Deepgram model — defaults to nova-3 (current best general-purpose). */
  model?: string;
  /** Force a specific language (BCP-47). Default lets Deepgram detect. */
  language?: string;
  /** Allow tests to swap fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Transcribe audio from a publicly-fetchable URL. Returns null when
 * DEEPGRAM_API_KEY is unset.
 */
export async function transcribeAudioFromUrl(
  audioUrl: string,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;

  const fetchFn = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    model: options.model ?? "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
  });
  if (options.language) params.set("language", options.language);
  else params.set("detect_language", "true");

  const res = await fetchFn(`${DEEPGRAM_API}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "<unreadable>");
    throw new Error(
      `Deepgram transcribe failed (${res.status}): ${errText.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as DeepgramListenResponse;
  return parseTranscript(data);
}

/**
 * Transcribe audio bytes (e.g. an upload) by POSTing the raw buffer.
 */
export async function transcribeAudioFromBuffer(
  audio: ArrayBuffer | Uint8Array,
  contentType: string,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;

  const fetchFn = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    model: options.model ?? "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
  });
  if (options.language) params.set("language", options.language);
  else params.set("detect_language", "true");

  const res = await fetchFn(`${DEEPGRAM_API}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": contentType,
    },
    body: audio instanceof Uint8Array ? new Blob([new Uint8Array(audio)]) : new Blob([new Uint8Array(audio as ArrayBuffer)]),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "<unreadable>");
    throw new Error(
      `Deepgram transcribe failed (${res.status}): ${errText.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as DeepgramListenResponse;
  return parseTranscript(data);
}

function parseTranscript(
  data: DeepgramListenResponse
): TranscriptionResult {
  // Prefer utterances (preserves turn order); fall back to channel alternatives.
  const utteranceText = (data.results?.utterances ?? [])
    .map((u) => u.transcript?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");

  const alternativeText = (data.results?.channels ?? [])
    .flatMap((c) => c.alternatives ?? [])
    .map((a) => a.transcript?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");

  const transcript = utteranceText || alternativeText;

  // Try to find the model name from a couple of common shapes.
  const modelFromArray = data.metadata?.models?.[0]?.name;
  const modelFromInfo =
    data.metadata?.model_info &&
    Object.values(data.metadata.model_info)[0]?.name;

  return {
    transcript,
    model: modelFromArray ?? modelFromInfo ?? "nova-3",
    durationSec: data.metadata?.duration,
    language: data.metadata?.detected_language,
  };
}

/** Exported for unit tests. */
export const __test__ = { parseTranscript };
