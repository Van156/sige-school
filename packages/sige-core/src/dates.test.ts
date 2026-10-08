import { describe, expect, test } from "bun:test";

import { DEFAULT_TIME_ZONE, isFutureDate, todayIn } from "./dates";

describe("todayIn", () => {
  test("uses the institution time zone, not UTC", () => {
    // 03:00 UTC on the 9th is still the 8th, 22:00, in Bogota (UTC-5).
    const now = new Date("2026-10-09T03:00:00Z");
    expect(now.toISOString().slice(0, 10)).toBe("2026-10-09");
    expect(todayIn(DEFAULT_TIME_ZONE, now)).toBe("2026-10-08");
  });

  test("rolls over at local midnight", () => {
    expect(todayIn("America/Bogota", new Date("2026-10-09T04:59:59Z"))).toBe("2026-10-08");
    expect(todayIn("America/Bogota", new Date("2026-10-09T05:00:00Z"))).toBe("2026-10-09");
  });

  test("defaults to America/Bogota", () => {
    expect(DEFAULT_TIME_ZONE).toBe("America/Bogota");
    expect(todayIn(undefined, new Date("2026-01-01T02:00:00Z"))).toBe("2025-12-31");
  });
});

describe("isFutureDate", () => {
  const now = new Date("2026-10-09T03:00:00Z"); // 2026-10-08 in Bogota

  test("today (in the institution time zone) is not future", () => {
    expect(isFutureDate("2026-10-08", now)).toBe(false);
  });

  test("the UTC date of that instant is already tomorrow locally, hence future", () => {
    expect(isFutureDate("2026-10-09", now)).toBe(true);
  });

  test("past dates are not future", () => {
    expect(isFutureDate("2000-02-29", now)).toBe(false);
  });
});
