import { timeBlockShiftSchema } from "@base-template/api/sige/schemas/scheduling";
import { applyClientList } from "@/shared/lib/data-table/client-list";
import { describe, expect, test } from "bun:test";

import type { TimeBlockRow } from "../types";
import {
  blockTypeLabel,
  SHIFT_OPTIONS,
  timeBlockAccessors,
  timeBlockCampusFilterOptions,
  timeBlockSearchSchema,
  timeBlockStats,
  toTimeBlockListState,
} from "./time-block-list";

const block = (overrides: Partial<TimeBlockRow>): TimeBlockRow => ({
  id: "b1",
  campusId: "c1",
  campusName: "Principal",
  name: "Bloque 1",
  shift: "Mañana",
  startTime: "07:00",
  endTime: "08:00",
  isBreak: false,
  orderNum: 1,
  academicYear: "2026",
  inUse: false,
  ...overrides,
});

const ROWS = [
  block({ id: "b1" }),
  block({ id: "b2", name: "Recreo", isBreak: true, orderNum: 2 }),
  block({ id: "b3", campusId: "c2", campusName: "Norte", shift: "Tarde", orderNum: 1 }),
];

describe("timeBlockSearchSchema", () => {
  test("defaults keep the server order with no filters", () => {
    expect(timeBlockSearchSchema.parse({})).toMatchObject({ sort: [], filters: [], page: 1 });
  });

  test("keeps the campus and shift filters", () => {
    expect(timeBlockSearchSchema.parse({ campus: "c1", shift: "Tarde" })).toMatchObject({
      campus: "c1",
      shift: "Tarde",
    });
  });
});

describe("client list over time blocks", () => {
  const run = (search: Record<string, unknown>) =>
    applyClientList(
      ROWS,
      toTimeBlockListState(timeBlockSearchSchema.parse(search)),
      timeBlockAccessors,
    );

  test("filters by campus and by shift", () => {
    expect(run({ campus: "c2" }).rows.map((row) => row.id)).toEqual(["b3"]);
    expect(run({ shift: "Mañana" }).rows.map((row) => row.id)).toEqual(["b1", "b2"]);
  });

  test("keeps the server order until the user sorts", () => {
    expect(run({}).rows.map((row) => row.id)).toEqual(["b1", "b2", "b3"]);
    expect(run({ sort: [{ id: "type", desc: true }] }).rows[0]?.id).toBe("b2");
  });
});

describe("filter options and labels", () => {
  test("campus choices are the distinct listed campuses", () => {
    expect(timeBlockCampusFilterOptions(ROWS)).toEqual([
      { value: "c1", label: "Principal" },
      { value: "c2", label: "Norte" },
    ]);
  });

  test("shift choices are the API's jornadas", () => {
    expect(SHIFT_OPTIONS.map((option) => option.value)).toEqual([...timeBlockShiftSchema.options]);
  });

  test("breaks read Recreo and the rest Clase", () => {
    expect(blockTypeLabel({ isBreak: true })).toBe("Recreo");
    expect(blockTypeLabel({ isBreak: false })).toBe("Clase");
  });

  test("stats count class blocks and breaks", () => {
    expect(timeBlockStats(ROWS)).toEqual({ total: 3, classes: 2, breaks: 1 });
    expect(timeBlockStats([])).toEqual({ total: 0, classes: 0, breaks: 0 });
  });
});
