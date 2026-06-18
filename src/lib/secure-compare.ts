import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison. Returns false on any length mismatch or
 * undefined input without leaking timing. Use for ALL secret/token checks.
 */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
