/**
 * Simple in-memory rate limiter using sliding window.
 * WARNING: Dev-only — this does not work across multiple instances or after restarts.
 * For production, replace with a Redis-backed implementation (e.g. @upstash/ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  analyze: { maxRequests: 10, windowMs: 60000 },      // 10 per minute
  chat: { maxRequests: 30, windowMs: 60000 },          // 30 per minute
  provision: { maxRequests: 5, windowMs: 60000 },      // 5 per minute
  api_v1: { maxRequests: 60, windowMs: 60000 },        // 60 per minute
  tasks: { maxRequests: 20, windowMs: 60000 },         // 20 per minute
};

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetAt - now,
  };
}

/**
 * Get a rate limit key from IP or user ID
 */
export function getRateLimitKey(
  endpoint: string,
  identifier: string
): string {
  return `${endpoint}:${identifier}`;
}
