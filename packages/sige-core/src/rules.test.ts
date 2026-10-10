import { describe, expect, test } from "bun:test";

import {
  SIGE_RULES,
  centsFromNumber,
  centsToNumber,
  divHalfUp,
  gradeMessages,
  parseCents,
  parseScore,
  parseWeight,
  roundHalfUp,
} from "./rules";

describe("SIGE_RULES (foundation §5.4/§5.5, 06 §3)", () => {
  test("fixes the grading scale and thresholds", () => {
    expect(SIGE_RULES.SCORE_MIN).toBe(1);
    expect(SIGE_RULES.SCORE_MAX).toBe(5);
    expect(SIGE_RULES.PASSING_GRADE).toBe(3);
    expect(SIGE_RULES.GOOD).toBe(4);
    expect(SIGE_RULES.EXCELLENCE).toBe(4.5);
    expect(SIGE_RULES.LEVEL_SUPERIOR).toBe(4.6);
    expect(SIGE_RULES.LEVEL_ALTO).toBe(4);
    expect(SIGE_RULES.LEVEL_BASICO).toBe(3);
    expect(SIGE_RULES.GRADE_OBSERVATION_MAX).toBe(500);
    expect(SIGE_RULES.SHEET_MAX_CELLS).toBe(2000);
  });

  test("cent thresholds mirror the decimal constants", () => {
    expect(SIGE_RULES.CENTS).toEqual({
      SCORE_MIN: 100,
      SCORE_MAX: 500,
      PASSING_GRADE: 300,
      GOOD: 400,
      EXCELLENCE: 450,
      RISK: 200,
      LEVEL_SUPERIOR: 460,
      LEVEL_ALTO: 400,
      LEVEL_BASICO: 300,
    });
  });
});

describe("divHalfUp / roundHalfUp", () => {
  test("rounds the quotient half-up", () => {
    expect(divHalfUp(5, 2)).toBe(3);
    expect(divHalfUp(4, 2)).toBe(2);
    expect(divHalfUp(7, 3)).toBe(2);
    expect(divHalfUp(8, 3)).toBe(3);
    expect(divHalfUp(0, 7)).toBe(0);
    // 2.995 as an exact rational (599 / 2 hundredths) -> 300, where 2.995 * 100 in floats is 299.4999…
    expect(divHalfUp(599, 2)).toBe(300);
  });

  test("roundHalfUp is the same operation", () => {
    expect(roundHalfUp(919, 2)).toBe(460);
    expect(roundHalfUp(917, 2)).toBe(459);
  });

  test("refuses non-integer, negative or zero-denominator input", () => {
    expect(() => divHalfUp(1.5, 2)).toThrow();
    expect(() => divHalfUp(-1, 2)).toThrow();
    expect(() => divHalfUp(1, 0)).toThrow();
  });
});

describe("parseCents (decimal strings, never floats)", () => {
  test("parses database numerics exactly", () => {
    expect(parseCents("4.25")).toBe(425);
    expect(parseCents("20.00")).toBe(2000);
    expect(parseCents("2.99")).toBe(299);
    expect(parseCents("5")).toBe(500);
    expect(parseCents("4.5")).toBe(450);
    expect(parseCents("100.00")).toBe(10000);
  });

  test("accepts a comma separator and surrounding blanks", () => {
    expect(parseCents("3,75")).toBe(375);
    expect(parseCents(" 4.1 ")).toBe(410);
  });

  test("rejects anything else", () => {
    for (const text of ["", " ", "4.", ".5", "4.255", "-1", "+4", "4e1", "abc", "4,2.1", "1 000"]) {
      expect(parseCents(text)).toBeNull();
    }
  });
});

describe("parseScore (06 §3, GRD-R2)", () => {
  test("blank is no grade", () => {
    expect(parseScore("")).toEqual({ status: "empty" });
    expect(parseScore("   ")).toEqual({ status: "empty" });
  });

  test("accepts . or , with up to two decimals in 1.00–5.00", () => {
    expect(parseScore("4,5")).toEqual({ status: "valid", cents: 450 });
    expect(parseScore("3.75")).toEqual({ status: "valid", cents: 375 });
    expect(parseScore("1")).toEqual({ status: "valid", cents: 100 });
    expect(parseScore("5.00")).toEqual({ status: "valid", cents: 500 });
  });

  test("everything else is invalid with the spec message", () => {
    for (const text of ["4.255", "0.99", "5.01", "0", "6", "abc", "4.", "-3"]) {
      expect(parseScore(text)).toEqual({ status: "invalid", message: gradeMessages.scoreRange });
    }
    expect(gradeMessages.scoreRange).toBe("La nota debe estar entre 1.0 y 5.0.");
  });
});

describe("parseWeight", () => {
  test("weights are hundredths of a percent in (0, 100]", () => {
    expect(parseWeight("20.00")).toBe(2000);
    expect(parseWeight("33.33")).toBe(3333);
    expect(parseWeight("100")).toBe(10000);
    expect(parseWeight("0")).toBeNull();
    expect(parseWeight("100.01")).toBeNull();
    expect(parseWeight("x")).toBeNull();
  });
});

describe("centsFromNumber / centsToNumber", () => {
  test("a JSON number converts through its shortest decimal form", () => {
    expect(centsFromNumber(4.25)).toBe(425);
    expect(centsFromNumber(2.995)).toBeNull();
    expect(centsFromNumber(4.1)).toBe(410);
    expect(centsFromNumber(5)).toBe(500);
    expect(centsFromNumber(Number.NaN)).toBeNull();
    expect(centsFromNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(centsFromNumber(1e-7)).toBeNull();
    expect(centsFromNumber(-1)).toBeNull();
  });

  test("cents back to a number", () => {
    expect(centsToNumber(425)).toBe(4.25);
    expect(centsToNumber(300)).toBe(3);
  });
});
