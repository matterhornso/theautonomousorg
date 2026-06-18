/**
 * Input validation helpers.
 * Simple schema validation without Zod dependency — keeps the bundle small.
 */

import net from "node:net";
import { lookup } from "node:dns/promises";

export interface ValidationError {
  field: string;
  message: string;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o < 0 || o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

/**
 * True if `ip` is loopback, private, link-local (incl. cloud metadata
 * 169.254.169.254), CGNAT, or otherwise non-public. Unparseable → treated as
 * unsafe. Handles IPv4, IPv6, and IPv4-mapped IPv6.
 */
export function isPrivateIp(ip: string): boolean {
  const addr = ip.trim().toLowerCase();
  if (addr.includes(":")) {
    if (addr === "::1" || addr === "::") return true;
    const mapped = addr.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateIp(mapped[1]);
    // fc00::/7 (ULA) and fe80::/10 (link-local)
    if (addr.startsWith("fc") || addr.startsWith("fd") || addr.startsWith("fe8") ||
        addr.startsWith("fe9") || addr.startsWith("fea") || addr.startsWith("feb")) return true;
    return false;
  }
  const n = ipv4ToInt(addr);
  if (n === null) return true;
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base);
    if (b === null) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||   // CGNAT
    inRange("127.0.0.0", 8) ||     // loopback
    inRange("169.254.0.0", 16) ||  // link-local + cloud metadata
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("192.0.0.0", 24) ||
    inRange("198.18.0.0", 15)      // benchmarking
  );
}

/**
 * SSRF-safe URL check. Runs the prefix validation, then RESOLVES the hostname
 * and rejects if the literal host or any resolved A/AAAA record is private.
 * Returns an error string or null if the URL is safe to fetch.
 * NOTE: callers must also re-check on every redirect hop (DNS can rebind).
 */
export async function assertPublicUrl(rawUrl: string): Promise<string | null> {
  const prefixError = validateUrl(rawUrl);
  if (prefixError) return prefixError;

  const trimmed = rawUrl.trim();
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  let host: string;
  try {
    host = new URL(withProtocol).hostname.replace(/^\[/, "").replace(/\]$/, "");
  } catch {
    return "Invalid URL format";
  }

  if (net.isIP(host)) {
    return isPrivateIp(host) ? "Cannot analyze local or private addresses" : null;
  }

  try {
    const records = await lookup(host, { all: true });
    if (!records.length) return "Could not resolve host";
    for (const r of records) {
      if (isPrivateIp(r.address)) return "Cannot analyze local or private addresses";
    }
    return null;
  } catch {
    return "Could not resolve host";
  }
}

export function validateUrl(url: string): string | null {
  if (!url || typeof url !== "string") return "URL is required";
  const trimmed = url.trim();
  if (trimmed.length < 4) return "URL is too short";
  if (trimmed.length > 2000) return "URL is too long";

  // Add protocol if missing
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "URL must use http or https";
    }
    if (!parsed.hostname.includes(".")) {
      return "URL must include a valid domain";
    }
    // Block local/private IPs
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("0.") ||
      hostname.startsWith("172.16.") || hostname.startsWith("172.17.") || hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") || hostname.startsWith("172.20.") || hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") || hostname.startsWith("172.23.") || hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") || hostname.startsWith("172.26.") || hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") || hostname.startsWith("172.29.") || hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname.startsWith("169.254.") ||
      hostname === "[::1]" || hostname === "::1" ||
      hostname.startsWith("[fe80:") || hostname.startsWith("[fc") || hostname.startsWith("[fd")
    ) {
      return "Cannot analyze local or private URLs";
    }
    return null;
  } catch {
    return "Invalid URL format";
  }
}

export function validateString(
  value: unknown,
  fieldName: string,
  opts: { required?: boolean; minLength?: number; maxLength?: number } = {}
): string | null {
  const { required = false, minLength = 0, maxLength = 10000 } = opts;

  if (value === undefined || value === null || value === "") {
    return required ? `${fieldName} is required` : null;
  }

  if (typeof value !== "string") {
    return `${fieldName} must be a string`;
  }

  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }

  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }

  return null;
}

export function validateArray(
  value: unknown,
  fieldName: string,
  opts: { required?: boolean; minLength?: number; maxLength?: number } = {}
): string | null {
  const { required = false, minLength = 0, maxLength = 50 } = opts;

  if (value === undefined || value === null) {
    return required ? `${fieldName} is required` : null;
  }

  if (!Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }

  if (value.length < minLength) {
    return `${fieldName} must have at least ${minLength} items`;
  }

  if (value.length > maxLength) {
    return `${fieldName} must have at most ${maxLength} items`;
  }

  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== "string") return "Email is required";
  const trimmed = email.trim();
  if (trimmed.length > 320) return "Email is too long";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format";
  return null;
}

/**
 * Sanitize user input to prevent XSS in stored content
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Validate a batch of fields, return first error or null
 */
export function validateFields(
  validations: (() => string | null)[]
): string | null {
  for (const validate of validations) {
    const error = validate();
    if (error) return error;
  }
  return null;
}
