/**
 * Drain a company's full Fireflies history into the company brain.
 *
 * The /api/memory/ingest/fireflies route caps each call at MAX_SYNC_IMPORT (8)
 * so a request can't run an unbounded batch of Claude extractions. This script
 * is the offline counterpart: it paginates through every transcript, feeding
 * each through the SAME pipeline (dedup on source_ref → ingestConversation), so
 * it's safe to re-run — already-imported meetings are skipped.
 *
 * Usage:
 *   FIREFLIES_API_KEY=ff_… DATABASE_URL=… \
 *     bun run scripts/fireflies-import.ts <companyId> [--page=8] [--max=500] [--dry]
 *
 *   --dry   list what would be imported without writing
 *   --page  transcripts per Fireflies page (default 8)
 *   --max   safety cap on total transcripts scanned (default 500)
 */

import {
  getFirefliesClient,
  transcriptToText,
  type FirefliesTranscript,
} from "../src/lib/fireflies";
import { existingConversationSourceRefs } from "../src/lib/knowledge-graph";
import { ingestConversation } from "../src/lib/entity-extractor";

const SOURCE = "fireflies";

function ok(s: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${s}`);
}
function info(s: string) {
  console.log(`  \x1b[36mi\x1b[0m ${s}`);
}
function fail(s: string, err?: unknown): never {
  console.log(`  \x1b[31m✗\x1b[0m ${s}`);
  if (err) console.error(err);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

async function main() {
  const companyId = process.argv[2];
  if (!companyId || companyId.startsWith("--")) {
    fail("Usage: bun run scripts/fireflies-import.ts <companyId> [--page=8] [--max=500] [--dry]");
  }
  const dry = process.argv.includes("--dry");
  const page = Math.max(1, Math.min(Number(arg("page")) || 8, 25));
  const max = Math.max(1, Number(arg("max")) || 500);

  const client = getFirefliesClient();
  if (!client) fail("FIREFLIES_API_KEY is not set.");

  info(`Draining Fireflies → company ${companyId} (page=${page}, max=${max}${dry ? ", DRY" : ""})`);

  let skip = 0;
  let scanned = 0;
  let imported = 0;
  let skipped = 0;
  let errored = 0;

  while (scanned < max) {
    let batch: FirefliesTranscript[];
    try {
      batch = await client!.listTranscripts({ limit: page, skip });
    } catch (err) {
      fail(`Fireflies fetch failed at skip=${skip}`, err);
    }
    if (batch.length === 0) break;
    scanned += batch.length;

    const already = await existingConversationSourceRefs(
      companyId,
      SOURCE,
      batch.map((t) => t.id)
    );

    for (const t of batch) {
      if (already.has(t.id)) {
        skipped += 1;
        continue;
      }
      const text = transcriptToText(t.sentences);
      if (!text.trim()) {
        skipped += 1;
        continue;
      }
      if (dry) {
        info(`would import "${t.title}" (${t.id})`);
        imported += 1;
        continue;
      }
      try {
        const occurredAt = (() => {
          const d = new Date(
            typeof t.date === "number" ? t.date : Date.parse(t.date)
          );
          return Number.isNaN(d.getTime()) ? undefined : d;
        })();
        const res = await ingestConversation({
          companyId,
          text,
          kind: "meeting",
          title: t.title || "Fireflies meeting",
          occurredAt,
          source: SOURCE,
          sourceRef: t.id,
          metadata: {
            firefliesId: t.id,
            transcriptUrl: t.transcript_url ?? null,
            durationSeconds: t.duration ?? null,
          },
          // Bulk history import lands in the shared brain.
          visibility: "company",
        });
        imported += 1;
        ok(`"${t.title}" → ${res.personIds.length}p ${res.decisionIds.length}d ${res.commitmentIds.length}c`);
      } catch (err) {
        errored += 1;
        console.log(`  \x1b[31m✗\x1b[0m "${t.title}" (${t.id})`);
        console.error(err);
      }
    }

    if (batch.length < page) break; // last page
    skip += page;
  }

  console.log("");
  info(`Done. scanned=${scanned} imported=${imported} skipped=${skipped} errored=${errored}`);
  if (scanned >= max) info(`Hit --max=${max}; re-run with a higher --max to continue.`);
}

main().catch((err) => fail("unexpected", err));
