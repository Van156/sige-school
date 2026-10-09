import { describe, expect, test } from "bun:test";

import {
  COURSE_CAPACITY_MAX,
  COURSE_CAPACITY_MIN,
  isValidCourseCapacity,
  isValidCriterionWeight,
  isValidPeriodOrder,
  periodsOverlap,
  sumWeights,
} from "./institution";

describe("isValidCriterionWeight (sige/02 §4.1)", () => {
  test.each([
    [0, false],
    [0.01, true],
    [50, true],
    [100, true],
    [100.01, false],
    [-1, false],
    [12.345, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
  ])("weight %p -> %p", (weight, expected) => {
    expect(isValidCriterionWeight(weight)).toBe(expected);
  });
});

describe("isValidPeriodOrder", () => {
  test.each([
    [0, false],
    [1, true],
    [4, true],
    [5, false],
    [2.5, false],
  ])("order %p -> %p", (order, expected) => {
    expect(isValidPeriodOrder(order)).toBe(expected);
  });
});

describe("isValidCourseCapacity", () => {
  test.each([
    [0, false],
    [1, true],
    [60, true],
    [61, false],
    [40.5, false],
  ])("capacity %p -> %p", (capacity, expected) => {
    expect(isValidCourseCapacity(capacity)).toBe(expected);
  });

  test("exposes the bounds", () => {
    expect([COURSE_CAPACITY_MIN, COURSE_CAPACITY_MAX]).toEqual([1, 60]);
  });
});

describe("sumWeights", () => {
  test("empty list sums to 0", () => {
    expect(sumWeights([])).toBe(0);
  });
  test("avoids floating point drift", () => {
    expect(sumWeights([0.1, 0.2])).toBe(0.3);
    expect(sumWeights([20, 20, 30, 30])).toBe(100);
    expect(sumWeights([33.33, 33.33, 33.34])).toBe(100);
  });
  test("reports a total that is not 100", () => {
    expect(sumWeights([20, 20, 30])).toBe(70);
  });
});

describe("periodsOverlap (INS-R9, closed ranges, same year)", () => {
  const a = { academicYear: "2026", startDate: "2026-01-20", endDate: "2026-03-31" };

  test("adjacent days do not overlap", () => {
    expect(periodsOverlap(a, { ...a, startDate: "2026-04-01", endDate: "2026-06-30" })).toBe(false);
  });
  test("sharing the boundary day overlaps (closed range)", () => {
    expect(periodsOverlap(a, { ...a, startDate: "2026-03-31", endDate: "2026-06-30" })).toBe(true);
  });
  test("same day ranges overlap", () => {
    const same = { ...a, startDate: "2026-02-01", endDate: "2026-02-01" };
    expect(periodsOverlap(same, same)).toBe(true);
  });
  test("contained range overlaps, symmetric", () => {
    const inner = { ...a, startDate: "2026-02-01", endDate: "2026-02-10" };
    expect(periodsOverlap(a, inner)).toBe(true);
    expect(periodsOverlap(inner, a)).toBe(true);
  });
  test("different academic years never overlap", () => {
    expect(periodsOverlap(a, { ...a, academicYear: "2027" })).toBe(false);
  });
});
