/**
 * Sliding-window rate limiting behind a port, so procedures stay deterministic under test
 * (inject a limiter with a fake clock through `Context.rateLimiter`).
 */
export type RateLimitRule = { limit: number; windowMs: number };

export interface RateLimiterPort {
  /** Records a hit for `key` and returns whether it is allowed. Refused hits are not recorded. */
  consume(key: string, rule: RateLimitRule): boolean;
}

/**
 * In-memory limiter (per process). Keeps each key's hit timestamps inside the window and drops
 * keys whose hits all expired, so memory is bounded by the active keys.
 */
export function createSlidingWindowLimiter(now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let lastSweep = 0;

  function sweep(at: number, windowMs: number) {
    if (at - lastSweep < windowMs) {
      return;
    }
    lastSweep = at;
    for (const [key, times] of hits) {
      if (times.length === 0 || (times.at(-1) ?? 0) <= at - windowMs) {
        hits.delete(key);
      }
    }
  }

  return {
    consume(key: string, { limit, windowMs }: RateLimitRule): boolean {
      const at = now();
      sweep(at, windowMs);
      const recent = (hits.get(key) ?? []).filter((time) => time > at - windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(at);
      hits.set(key, recent);
      return true;
    },
    /** Keys currently tracked (for tests). */
    size: () => hits.size,
  } satisfies RateLimiterPort & { size(): number };
}

/** Process-wide limiter used when the context supplies none. */
export const defaultRateLimiter: RateLimiterPort = createSlidingWindowLimiter();
