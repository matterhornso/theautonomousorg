/**
 * Mint / list / revoke device API keys for the recorder webhook
 * (POST /api/recorder/ingest). Hand the created key to the OEM; it's shown ONCE.
 *
 * Usage:
 *   DATABASE_URL=… bun run scripts/recorder-key.ts create <companyId> [label]
 *   DATABASE_URL=… bun run scripts/recorder-key.ts list   <companyId>
 *   DATABASE_URL=… bun run scripts/recorder-key.ts revoke <keyId>
 */

import {
  createRecorderKey,
  listRecorderKeys,
  revokeRecorderKey,
} from "../src/lib/recorder-keys";

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

async function main() {
  const cmd = process.argv[2];
  const target = process.argv[3];

  if (cmd === "create") {
    if (!target) fail("Usage: recorder-key.ts create <companyId> [label]");
    const label = process.argv.slice(4).join(" ") || undefined;
    const res = await createRecorderKey(target, label);
    if (!res) fail("no DB (set DATABASE_URL)");
    ok(`created key ${res.id} for company ${target}`);
    console.log("");
    console.log("  Give this to the OEM — it is shown ONCE, only its hash is stored:");
    console.log(`\n    ${res.key}\n`);
    info("Send in the X-TA-Api-Key header to POST /api/recorder/ingest.");
    return;
  }

  if (cmd === "list") {
    if (!target) fail("Usage: recorder-key.ts list <companyId>");
    const keys = await listRecorderKeys(target);
    if (keys.length === 0) {
      info("no keys for this company");
      return;
    }
    for (const k of keys) {
      const state = k.revokedAt ? "\x1b[31mrevoked\x1b[0m" : "\x1b[32mactive\x1b[0m";
      info(
        `${k.id} [${state}] label=${k.label ?? "-"} created=${k.createdAt} lastUsed=${k.lastUsedAt ?? "never"}`
      );
    }
    return;
  }

  if (cmd === "revoke") {
    if (!target) fail("Usage: recorder-key.ts revoke <keyId>");
    const done = await revokeRecorderKey(target);
    if (!done) fail(`no active key with id ${target}`);
    ok(`revoked ${target}`);
    return;
  }

  fail("Usage: recorder-key.ts <create|list|revoke> …");
}

main().catch((err) => fail("unexpected", err));
