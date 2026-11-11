/** In-memory fixed-window rate limiter for API route handlers.
 *
 * Single-instance by design (Next.js server): counters live on globalThis so
 * dev hot-reload does not reset them. Behind a multi-instance deployment swap
 * this module for a Redis-backed implementation — the call sites stay identical.
 */

import { jsonError } from "@/lib/server/http";

type Bucket = { count: number; resetAt: number };

const globalForRl = globalThis as unknown as { __careeriqRateLimits?: Map<string, Bucket> };

function buckets(): Map<string, Bucket> {
  if (!globalForRl.__careeriqRateLimits) {
    globalForRl.__careeriqRateLimits = new Map();
  }
  return globalForRl.__careeriqRateLimits;
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

/** Consume one token from `key`'s window. `now` is injectable for tests. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const map = buckets();
  if (map.size > 10_000) {
    for (const [k, b] of map) {
      if (b.resetAt <= now) map.delete(k);
    }
  }
  let bucket = map.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    map.set(key, bucket);
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

/** Standard 429 envelope with Retry-After hint, matching jsonError shape. */
export function rateLimitError(retryAfterSec: number) {
  return jsonError(
    429,
    "RATE_LIMITED",
    `Too many requests — try again in ${retryAfterSec}s.`,
    { retry_after: retryAfterSec }
  );
}

/** Guard a mutation route: returns a 429 response when the budget is spent, else null. */
export function rateLimitOr429(
  userId: string,
  route: string,
  limit = 30,
  windowMs = 60_000
): ReturnType<typeof rateLimitError> | null {
  const result = rateLimit(`${route}:${userId}`, limit, windowMs);
  if (result.ok) return null;
  return rateLimitError(result.retryAfterSec);
}

/** Test-only: clear all buckets. */
export function resetRateLimits(): void {
  buckets().clear();
}
