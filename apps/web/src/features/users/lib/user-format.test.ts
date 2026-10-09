import { describe, expect, test } from "bun:test";

import { formatLastAccess, formatUserDate } from "./user-format";

describe("user dates", () => {
  test("formats dd/mm/yyyy", () => {
    expect(formatUserDate("2026-01-10T15:30:00.000Z", "America/Bogota")).toBe("10/01/2026");
  });

  test("formats the last access with a 24-hour time", () => {
    expect(formatLastAccess("2026-01-10T20:05:00.000Z", "America/Bogota")).toBe("10/01/2026 15:05");
  });

  test("a user that never signed in reads Nunca", () => {
    expect(formatLastAccess(null)).toBe("Nunca");
  });
});
