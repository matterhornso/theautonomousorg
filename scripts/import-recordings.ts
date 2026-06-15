/**
 * Import voice-recorder audio files into the company brain.
 *
 * The "watched folder" path for The Autonomous Recorder: pull MP3s off the
 * device (USB-C or the companion app's auto-transfer) into a folder, and this
 * drains each file through the SAME pipeline the API routes use —
 * Deepgram transcription → entity extraction → knowledge graph. It is the
 * offline, no-server counterpart to /api/memory/ingest/audio-upload.
 *
 * Idempotent: each file is keyed on its filename as `conversations.source_ref`,
 * so re-running (or a crash mid-batch) never double-imports. With --archive,
 * processed files also move to <folder>/_imported so the inbox stays clean.
 *
 * Usage:
 *   DEEPGRAM_API_KEY=… DATABASE_URL=… \
 *     bun run scripts/import-recordings.ts <companyId> <folder> [flags]
 *
 *   --watch            keep running, poll the folder for new files
 *   --interval=<sec>   poll interval in watch mode (default 15)
 *   --archive          move imported files to <folder>/_imported
 *   --lang=<bcp47>     force a language (default: auto-detect)
 *   --private          import as private to --owner (default: company-shared)
 *   --owner=<userId>   Clerk user id required when --private
 *   --dry              list what would be imported, don't write
 */

import {
  readdirSync,
  readFileSync,
  statSync,
  mkdirSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join, basename, extname } from "node:path";
import {
  isDeepgramConfigured,
  transcribeAudioFromBuffer,
} from "../src/lib/deepgram";
import { ingestConversation } from "../src/lib/entity-extractor";
import { existingConversationSourceRefs } from "../src/lib/knowledge-graph";

const SOURCE = "recorder";

// Audio container → content type Deepgram accepts.
const AUDIO_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
  ".flac": "audio/flac",
};

// Skip files written within this window — they may still be transferring.
const SETTLE_MS = 5_000;

function ok(s: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${s}`);
}
function info(s: string) {
  console.log(`  \x1b[36mi\x1b[0m ${s}`);
}
function warn(s: string) {
  console.log(`  \x1b[33m!\x1b[0m ${s}`);
}
function fail(s: string, err?: unknown): never {
  console.log(`  \x1b[31m✗\x1b[0m ${s}`);
  if (err) console.error(err);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Options {
  companyId: string;
  folder: string;
  archive: boolean;
  language?: string;
  visibility: "company" | "private";
  ownerUserId?: string;
  dry: boolean;
}

function listAudioFiles(folder: string): string[] {
  return readdirSync(folder)
    .filter((f) => AUDIO_TYPES[extname(f).toLowerCase()])
    .filter((f) => {
      const full = join(folder, f);
      try {
        const st = statSync(full);
        if (!st.isFile()) return false;
        // settle guard: skip a file that was just touched (still transferring)
        return Date.now() - st.mtimeMs > SETTLE_MS;
      } catch {
        return false;
      }
    });
}

async function processOnce(opts: Options): Promise<{ imported: number }> {
  const files = listAudioFiles(opts.folder);
  if (files.length === 0) return { imported: 0 };

  // Idempotency: drop files already represented in the graph by source_ref.
  // --dry only previews the folder, so it never touches the DB.
  const already = opts.dry
    ? new Set<string>()
    : await existingConversationSourceRefs(opts.companyId, SOURCE, files);
  const fresh = files.filter((f) => !already.has(f));
  if (fresh.length === 0) return { imported: 0 };

  info(`${fresh.length} new file(s) to import (${already.size} already in graph)`);

  let imported = 0;
  for (const file of fresh) {
    const full = join(opts.folder, file);
    const ext = extname(file).toLowerCase();
    const contentType = AUDIO_TYPES[ext] ?? "audio/mpeg";
    const title = basename(file, ext);

    if (opts.dry) {
      info(`would import "${file}"`);
      imported += 1;
      continue;
    }

    try {
      const bytes = new Uint8Array(readFileSync(full));
      const occurredAt = (() => {
        try {
          return statSync(full).mtime;
        } catch {
          return undefined;
        }
      })();

      const transcript = await transcribeAudioFromBuffer(bytes, contentType, {
        language: opts.language,
      });
      if (!transcript || !transcript.transcript.trim()) {
        warn(`empty transcript, skipping "${file}"`);
        continue;
      }

      const res = await ingestConversation({
        companyId: opts.companyId,
        text: transcript.transcript,
        kind: "meeting",
        title,
        occurredAt,
        source: SOURCE,
        sourceRef: file, // filename is the dedup key
        metadata: {
          capture: "recorder_folder",
          file,
          contentType,
          transcriptionModel: transcript.model,
          durationSec: transcript.durationSec,
          detectedLanguage: transcript.language,
        },
        visibility: opts.visibility,
        ownerUserId:
          opts.visibility === "private" ? opts.ownerUserId : undefined,
      });

      imported += 1;
      ok(
        `"${file}" → ${res.personIds.length}p ${res.decisionIds.length}d ${res.commitmentIds.length}c`
      );

      if (opts.archive) {
        const dir = join(opts.folder, "_imported");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        try {
          renameSync(full, join(dir, file));
        } catch (err) {
          warn(`imported but could not archive "${file}": ${String(err)}`);
        }
      }
    } catch (err) {
      warn(`failed "${file}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { imported };
}

async function main() {
  const companyId = process.argv[2];
  const folder = process.argv[3];
  if (!companyId || companyId.startsWith("--") || !folder || folder.startsWith("--")) {
    fail(
      "Usage: bun run scripts/import-recordings.ts <companyId> <folder> [--watch] [--interval=15] [--archive] [--lang=en] [--private --owner=<userId>] [--dry]"
    );
  }
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    fail(`folder not found: ${folder}`);
  }
  // --dry never transcribes, so Deepgram isn't needed to preview the queue.
  if (!flag("dry") && !isDeepgramConfigured()) {
    fail("DEEPGRAM_API_KEY is not set — transcription needs Deepgram.");
  }

  const visibility: "company" | "private" = flag("private") ? "private" : "company";
  const ownerUserId = arg("owner");
  if (visibility === "private" && !ownerUserId) {
    fail("--private requires --owner=<clerkUserId>");
  }

  const opts: Options = {
    companyId,
    folder,
    archive: flag("archive"),
    language: arg("lang"),
    visibility,
    ownerUserId,
    dry: flag("dry"),
  };

  const watch = flag("watch");
  const intervalMs = Math.max(5, Number(arg("interval")) || 15) * 1000;

  info(
    `Importing recordings → company ${companyId} from ${folder}` +
      `${watch ? ` (watch, every ${intervalMs / 1000}s)` : ""}` +
      `${opts.dry ? " [DRY]" : ""}${opts.visibility === "private" ? " [PRIVATE]" : ""}`
  );

  if (!watch) {
    const { imported } = await processOnce(opts);
    info(`Done. imported=${imported}`);
    return;
  }

  // Watch loop — poll, import, repeat. Ctrl-C to stop.
  let total = 0;
  for (;;) {
    try {
      const { imported } = await processOnce(opts);
      total += imported;
      if (imported > 0) info(`running total imported=${total}`);
    } catch (err) {
      warn(`pass failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(intervalMs);
  }
}

main().catch((err) => fail("unexpected", err));
