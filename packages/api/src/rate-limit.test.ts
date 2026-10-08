import { describe, expect, test } from "bun:test";

import { createSlidingWindowLimiter } from "./rate-limit";

const rule = { limit: 3, windowMs: 60_000 };

describe("createSlidingWindowLimiter", () => {
  test("allows `limit` hits per window and then refuses", () => {
    let now = 0;
    const limiter = createSlidingWindowLimiter(() => now);
    expect([1, 2, 3, 4].map(() => limiter.consume("a", rule))).toEqual([true, true, true, false]);
    now += 1;
    expect(limiter.consume("a", rule)).toBe(false);
  });

  test("refused hits do not extend the block", () => {
    let now = 0;
    const limiter = createSlidingWindowLimiter(() => now);
    for (let i = 0; i < 3; i += 1) limiter.consume("a", rule);
    now = 30_000;
    expect(limiter.consume("a", rule)).toBe(false);
    now = 60_000; // the first three hits left the window
    expect(limiter.consume("a", rule)).toBe(true);
  });

  test("the window slides hit by hit", () => {
    let now = 0;
    const limiter = createSlidingWindowLimiter(() => now);
    limiter.consume("a", rule); // t=0
    now = 20_000;
    limiter.consume("a", rule);
    limiter.consume("a", rule);
    expect(limiter.consume("a", rule)).toBe(false);
    now = 60_000; // only the t=0 hit expired
    expect(limiter.consume("a", rule)).toBe(true);
    expect(limiter.consume("a", rule)).toBe(false);
  });

  test("keys are independent", () => {
    const limiter = createSlidingWindowLimiter(() => 0);
    for (let i = 0; i < 3; i += 1) limiter.consume("a", rule);
    expect(limiter.consume("a", rule)).toBe(false);
    expect(limiter.consume("b", rule)).toBe(true);
  });

  test("idle keys are evicted so memory stays bounded", () => {
    let now = 0;
    const limiter = createSlidingWindowLimiter(() => now);
    limiter.consume("a", rule);
    now = 120_000;
    limiter.consume("b", rule);
    expect(limiter.size()).toBe(1);
  });
});
