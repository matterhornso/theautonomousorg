/**
 * Shared request-security helpers for API routes.
 *   - safeSecretEqual: constant-time secret comparison (avoids timing oracles).
 *   - isPubliclyFetchableHttpUrl: SSRF guard for URLs we hand to an external
 *     fetcher (e.g. Deepgram fetching `audioUrl`).
 */

import { timingSafeEqual } from "crypto";

/**
 * Constant-time string compare. Returns false if `expected` is unset/empty, so
 * an unconfigured INTERNAL_SECRET can never authenticate a caller.
 */
export function safeSecretEqual(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length check is non-secret (already leaked by the buffers); compare against
  // a fixed-length digest-free path only when lengths match.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Private / loopback / link-local IPv4 literals and obvious internal hosts we
// must never let an external fetcher reach (SSRF → cloud metadata, internal svc).
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

/**
 * True only for an https URL with a host that is not loopback/private/link-local.
 * Used before handing a caller-supplied `audioUrl` to Deepgram, which fetches it
 * server-side (an SSRF vector otherwise). Hostname-based — does not resolve DNS,
 * so it blocks literal-IP and obvious-internal abuse, not DNS-rebinding (accept
 * that residual risk; the fetch is performed by Deepgram, not our network).
 */
export function isPubliclyFetchableHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isPrivateIpv4(host)) return false;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false; // IPv6 link-local/ULA
  return true;
}
