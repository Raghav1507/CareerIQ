import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, rateLimitOr429, resetRateLimits } from "@/lib/server/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then blocks with retryAfterSec", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      const r = rateLimit("k", 3, 60_000, now);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.remaining).toBe(2 - i);
    }
    const blocked = rateLimit("k", 3, 60_000, now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const t0 = 5_000_000;
    expect(rateLimit("w", 1, 60_000, t0).ok).toBe(true);
    expect(rateLimit("w", 1, 60_000, t0 + 30_000).ok).toBe(false);
    expect(rateLimit("w", 1, 60_000, t0 + 60_001).ok).toBe(true);
  });

  it("keeps keys independent", () => {
    const now = 9_000_000;
    expect(rateLimit("a", 1, 60_000, now).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000, now).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, now).ok).toBe(true);
  });

  it("rateLimitOr429 returns null under budget and a 429 response over it", async () => {
    expect(rateLimitOr429("user-1", "route", 1)).toBeNull();
    const resp = rateLimitOr429("user-1", "route", 1);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(429);
    const body = await resp!.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.details.retry_after).toBeGreaterThan(0);
  });
});
