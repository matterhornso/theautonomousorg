import { randomUUID, createHash } from "crypto";

// API key format: ta_live_<32 hex chars>
export function generateApiKey(): { key: string; hash: string } {
  const raw = `ta_live_${randomUUID().replace(/-/g, "")}`;
  const hash = hashApiKey(raw);
  return { key: raw, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
