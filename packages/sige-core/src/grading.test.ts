import { describe, expect, test } from "bun:test";

import {
  annualDef,
  annualStatus,
  classStats,
  formatCellScore,
  formatFinal,
  formatScore,
  meanCents,
  performanceLevel,
  periodFinal,
  scoreBuckets,
  scoreClass,
  statusOf,
} from "./grading";
import type { CriterionWeight } from "./grading";

const quarters: CriterionWeight[] = [
  { id: "seg", weight: 2500 },
  { id: "for", weight: 2500 },
  { id: "cog", weight: 2500 },
  { id: "pro", weight: 2500 },
];
const halves: CriterionWeight[] = [
  { id: "a", weight: 5000 },
  { id: "b", weight: 5000 },
];
const pair = (a: number, b: number) => [
  { criterionId: "a", score: a },
  { criterionId: "b", score: b },
];

describe("periodFinal (06 §3)", () => {
  test("all criteria scored with Σ weights = 100 equals Σ score × weight / 100", () => {
    const scores = [
      { criterionId: "seg", score: 400 },
      { criterionId: "for", score: 350 },
      { criterionId: "cog", score: 300 },
      { criterionId: "pro", score: 450 },
    ];
    expect(periodFinal(scores, quarters)).toBe(375);
  });

  test("normalises over the criteria that have a score", () => {
    const criteria = [
      { id: "a", weight: 3000 },
      { id: "b", weight: 2000 },
      { id: "c", weight: 5000 },
    ];
    expect(
      periodFinal(
        [
          { criterionId: "a", score: 400 },
          { criterionId: "b", score: 300 },
        ],
        criteria,
      ),
    ).toBe(360);
  });

  test("weights that do not sum to 100", () => {
    const criteria = [
      { id: "a", weight: 3000 },
      { id: "b", weight: 3000 },
    ];
    expect(periodFinal(pair(400, 500), criteria)).toBe(450);
  });

  test("nothing scored is null", () => {
    expect(periodFinal([], quarters)).toBeNull();
    expect(periodFinal([{ criterionId: "zzz", score: 400 }], quarters)).toBeNull();
    expect(periodFinal(pair(400, 400), [])).toBeNull();
  });

  test("half-up at x.xx5 on exact hundredths", () => {
    expect(periodFinal(pair(299, 300), halves)).toBe(300); // 2.995 -> 3.00
    expect(periodFinal(pair(299, 299), halves)).toBe(299);
    expect(periodFinal(pair(459, 460), halves)).toBe(460); // 4.595 -> 4.60
    expect(periodFinal(pair(459, 459), halves)).toBe(459);
  });

  test("clamps to 1.00–5.00", () => {
    expect(periodFinal(pair(600, 600), halves)).toBe(500);
    expect(periodFinal(pair(50, 50), halves)).toBe(100);
  });

  test("ignores scores of criteria that are not in the list", () => {
    expect(
      periodFinal(
        [
          { criterionId: "a", score: 400 },
          { criterionId: "gone", score: 100 },
        ],
        halves,
      ),
    ).toBe(400);
  });
});

describe("statusOf / performanceLevel on the rounded final", () => {
  test("2.995 rounds to 3.00 and is ganada", () => {
    const final = periodFinal(pair(299, 300), halves);
    expect(statusOf(final)).toBe("ganada");
    expect(performanceLevel(final)).toBe("Básico");
  });

  test("status boundaries", () => {
    expect(statusOf(299)).toBe("perdida");
    expect(statusOf(300)).toBe("ganada");
    expect(statusOf(null)).toBe("no evaluado");
  });

  test("4.595 rounds to 4.60 and is Superior", () => {
    expect(performanceLevel(periodFinal(pair(459, 460), halves))).toBe("Superior");
  });

  test("level boundaries", () => {
    expect(performanceLevel(459)).toBe("Alto");
    expect(performanceLevel(460)).toBe("Superior");
    expect(performanceLevel(400)).toBe("Alto");
    expect(performanceLevel(399)).toBe("Básico");
    expect(performanceLevel(300)).toBe("Básico");
    expect(performanceLevel(299)).toBe("Bajo");
    expect(performanceLevel(100)).toBe("Bajo");
    expect(performanceLevel(null)).toBeNull();
  });
});

describe("scoreClass", () => {
  test("4.5 / 4.0 / 3.0 / 2.0 tones", () => {
    expect(scoreClass(500)).toBe("excellent");
    expect(scoreClass(450)).toBe("excellent");
    expect(scoreClass(449)).toBe("good");
    expect(scoreClass(400)).toBe("good");
    expect(scoreClass(399)).toBe("passing");
    expect(scoreClass(300)).toBe("passing");
    expect(scoreClass(299)).toBe("risk");
    expect(scoreClass(200)).toBe("risk");
    expect(scoreClass(199)).toBe("critical");
  });
});

describe("annualDef / annualStatus", () => {
  test("half-up mean of the available finals", () => {
    expect(annualDef([300, 299])).toBe(300); // 2.995
    expect(annualDef([400, null, 350])).toBe(375);
    expect(annualDef([333, 333, 334])).toBe(333); // 3.3333…
    expect(annualDef([334, 334, 333])).toBe(334); // 3.3366…
    expect(annualDef([])).toBeNull();
    expect(annualDef([null, null])).toBeNull();
  });

  test("status on the rounded DEF", () => {
    expect(annualStatus(annualDef([300, 299]))).toBe("aprobado");
    expect(annualStatus(299)).toBe("reprobado");
    expect(annualStatus(null)).toBe("no evaluado");
  });

  test("meanCents is the shared half-up mean", () => {
    expect(meanCents([])).toBeNull();
    expect(meanCents([100, 101])).toBe(101);
  });
});

describe("scoreBuckets", () => {
  test("edges 1.99, 2.0, 4.99, 5.0", () => {
    expect(scoreBuckets([100, 199, 200, 299, 300, 399, 400, 499, 500])).toEqual([
      { label: "1.0-1.9", count: 2, tone: "red" },
      { label: "2.0-2.9", count: 2, tone: "orange" },
      { label: "3.0-3.9", count: 2, tone: "amber" },
      { label: "4.0-4.9", count: 2, tone: "teal" },
      { label: "5.0", count: 1, tone: "blue" },
    ]);
  });

  test("empty input gives zero counts", () => {
    expect(scoreBuckets([]).map((bucket) => bucket.count)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("classStats", () => {
  const rows = [
    { scores: pair(500, 500), final: 500 },
    { scores: [{ criterionId: "a", score: 300 }], final: 300 },
    { scores: pair(200, 200), final: 200 },
    { scores: [{ criterionId: "b", score: 400 }], final: 400 },
    { scores: [], final: null },
  ];

  test("means, rates, extremes and counts", () => {
    const stats = classStats(rows, halves);
    expect(stats.total).toBe(5);
    expect(stats.evaluated).toBe(4);
    expect(stats.notEvaluated).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.mean).toBe(350);
    expect(stats.passRate).toBe(75);
    expect(stats.max).toBe(500);
    expect(stats.min).toBe(200);
    expect(stats.criteria).toEqual([
      { criterionId: "a", mean: 333, count: 3 },
      { criterionId: "b", mean: 367, count: 3 },
    ]);
  });

  test("population standard deviation, one decimal", () => {
    // finals 5, 3, 2, 4: mean 3.5, population variance 1.25, SD 1.118… -> 1.1
    expect(classStats(rows, halves).standardDeviation).toBe(1.1);
    const flat = [300, 300].map((final) => ({ scores: [], final }));
    expect(classStats(flat, halves).standardDeviation).toBe(0);
    // finals 3.00 and 3.10: SD 0.05 -> 0.1 (half-up on the exact value)
    const half = [300, 310].map((final) => ({ scores: [], final }));
    expect(classStats(half, halves).standardDeviation).toBe(0.1);
  });

  test("pass rate keeps one decimal", () => {
    const thirds = [300, 300, 200].map((final) => ({ scores: [], final }));
    expect(classStats(thirds, halves).passRate).toBe(66.7);
  });

  test("an empty class has nulls", () => {
    const stats = classStats([], halves);
    expect(stats).toEqual({
      total: 0,
      evaluated: 0,
      notEvaluated: 0,
      failed: 0,
      mean: null,
      passRate: null,
      max: null,
      min: null,
      standardDeviation: null,
      criteria: [
        { criterionId: "a", mean: null, count: 0 },
        { criterionId: "b", mean: null, count: 0 },
      ],
    });
  });
});

describe("display formatting (06 §3)", () => {
  test("cells show one decimal when only one is significant, two otherwise", () => {
    expect(formatCellScore(400)).toBe("4.0");
    expect(formatCellScore(450)).toBe("4.5");
    expect(formatCellScore(375)).toBe("3.75");
    expect(formatCellScore(301)).toBe("3.01");
    expect(formatCellScore(500)).toBe("5.0");
  });

  test("the live final always shows two decimals", () => {
    expect(formatFinal(300)).toBe("3.00");
    expect(formatFinal(375)).toBe("3.75");
    expect(formatFinal(null)).toBe("-");
  });

  test("averages round half-up to the requested decimals", () => {
    expect(formatScore(345, 1)).toBe("3.5");
    expect(formatScore(344, 1)).toBe("3.4");
    expect(formatScore(495, 1)).toBe("5.0");
    expect(formatScore(345, 2)).toBe("3.45");
  });
});

/* ------------------------- 1,000-case BigInt reference ------------------------- */

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exact rational reference: q = num / den, half-up when 2·(num mod den) ≥ den, then clamp. */
function referenceFinal(
  scores: readonly { criterionId: string; score: number }[],
  criteria: readonly CriterionWeight[],
): number | null {
  let num = 0n;
  let den = 0n;
  for (const criterion of criteria) {
    const cell = scores.find((entry) => entry.criterionId === criterion.id);
    if (!cell) continue;
    num += BigInt(cell.score) * BigInt(criterion.weight);
    den += BigInt(criterion.weight);
  }
  if (den === 0n) return null;
  let cents = num / den + (2n * (num % den) >= den ? 1n : 0n);
  if (cents < 100n) cents = 100n;
  if (cents > 500n) cents = 500n;
  return Number(cents);
}

describe("periodFinal against an exact BigInt reference", () => {
  test("1,000 deterministic random cases, biased towards x.xx5 ties", () => {
    const random = mulberry32(20261010);
    const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
    let ties = 0;
    for (let index = 0; index < 1000; index += 1) {
      const count = int(1, 6);
      // A third of the cases use equal weights so exact halves of a hundredth are frequent.
      const equal = index % 3 === 0 ? int(1, 10000) : null;
      const criteria = Array.from({ length: count }, (_, position) => ({
        id: `c${position}`,
        weight: equal ?? int(1, 10000),
      }));
      const scores = criteria
        .filter(() => random() < 0.85)
        .map((criterion) => ({ criterionId: criterion.id, score: int(100, 500) }));
      const expected = referenceFinal(scores, criteria);
      expect(periodFinal(scores, criteria)).toBe(expected);
      if (scores.length === 2 && equal !== null && (scores[0]!.score + scores[1]!.score) % 2 === 1)
        ties += 1;
    }
    expect(ties).toBeGreaterThan(20);
  });
});
