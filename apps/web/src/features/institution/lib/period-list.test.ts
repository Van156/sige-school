import { describe, expect, test } from "bun:test";

import { formatIsoDate, periodCountWarning, resolveYear, yearChoices } from "./period-list";

const summary = [
  { academicYear: "2026", periodCount: 4, warning: null },
  { academicYear: "2025", periodCount: 2, warning: "Este año tiene 2 de 4 periodos." },
];

describe("period list helpers", () => {
  test("formats ISO dates as dd/mm/yyyy without touching the timezone", () => {
    expect(formatIsoDate("2026-01-05")).toBe("05/01/2026");
    expect(formatIsoDate("not-a-date")).toBe("not-a-date");
  });

  test("resolves the shown year: pick, then current, then newest", () => {
    expect(resolveYear("2025", "2026", ["2024"])).toBe("2025");
    expect(resolveYear(null, "2026", ["2024"])).toBe("2026");
    expect(resolveYear(null, undefined, ["2024"])).toBe("2024");
    expect(resolveYear(null, undefined, [])).toBeNull();
  });

  test("offers every year with periods plus the current one, newest first", () => {
    expect(yearChoices(summary, "2027")).toEqual(["2027", "2026", "2025"]);
    expect(yearChoices(summary, "2026")).toEqual(["2026", "2025"]);
    expect(yearChoices([], undefined)).toEqual([]);
  });

  test("warns about a year with fewer than four periods, including none", () => {
    expect(periodCountWarning(summary, "2026")).toBeNull();
    expect(periodCountWarning(summary, "2025")).toBe("Este año tiene 2 de 4 periodos.");
    expect(periodCountWarning(summary, "2027")).toBe("Este año tiene 0 de 4 periodos.");
  });
});
