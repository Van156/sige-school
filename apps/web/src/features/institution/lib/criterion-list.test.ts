import { describe, expect, test } from "bun:test";

import { formatWeight, truncateDescription, weightsNeedWarning } from "./criterion-list";

describe("criterion list helpers", () => {
  test("formats weights as {n}% without trailing zeros", () => {
    expect(formatWeight(20)).toBe("20%");
    expect(formatWeight(33.3)).toBe("33.3%");
    expect(formatWeight(12.345)).toBe("12.35%");
  });

  test("truncates descriptions to 50 characters plus an ellipsis", () => {
    expect(truncateDescription(null)).toBe("-");
    expect(truncateDescription("Corta")).toBe("Corta");
    expect(truncateDescription("a".repeat(50))).toBe("a".repeat(50));
    expect(truncateDescription("a".repeat(51))).toBe(`${"a".repeat(50)}...`);
  });

  test("warns when the total is not 100, but not for an empty list", () => {
    expect(weightsNeedWarning(4, 100)).toBe(false);
    expect(weightsNeedWarning(4, 90)).toBe(true);
    expect(weightsNeedWarning(1, 100.01)).toBe(true);
    expect(weightsNeedWarning(0, 0)).toBe(false);
  });
});
