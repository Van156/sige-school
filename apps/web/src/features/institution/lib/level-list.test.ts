import { describe, expect, test } from "bun:test";

import { applyClientList } from "@/shared/lib/data-table/client-list";

import type { LevelRow } from "../types";
import {
  formatCourseCount,
  levelAccessors,
  levelCampusFilterOptions,
  levelSearchSchema,
  toLevelListState,
} from "./level-list";

function level(overrides: Partial<LevelRow> & { id: string; name: string }): LevelRow {
  return {
    campusId: "c1",
    campusName: "Sede Principal",
    orderNum: 0,
    courseCount: 0,
    ...overrides,
  };
}

const rows = [
  level({ id: "1", name: "Transición", orderNum: 0, courseCount: 1 }),
  level({ id: "2", name: "Primero", orderNum: 1, courseCount: 3 }),
  level({ id: "3", name: "Primero", orderNum: 1, campusId: "c2", campusName: "Sede Norte" }),
];

describe("levelCampusFilterOptions", () => {
  test("lists each campus once, in first-seen order", () => {
    expect(levelCampusFilterOptions(rows)).toEqual([
      { value: "c1", label: "Sede Principal" },
      { value: "c2", label: "Sede Norte" },
    ]);
    expect(levelCampusFilterOptions([])).toEqual([]);
  });
});

describe("level client list", () => {
  const list = (search: Record<string, unknown>) =>
    applyClientList(
      rows,
      toLevelListState(levelSearchSchema.parse(search)),
      levelAccessors,
    ).rows.map((row) => row.id);

  test("keeps the server order until the user sorts", () => {
    expect(list({})).toEqual(["1", "2", "3"]);
  });

  test("filters by name text and campus", () => {
    expect(list({ name: "primero" })).toEqual(["2", "3"]);
    expect(list({ campus: "c2" })).toEqual(["3"]);
    expect(list({ name: "primero", campus: "c1" })).toEqual(["2"]);
  });

  test("sorts by course count", () => {
    expect(list({ sort: [{ id: "courseCount", desc: true }] })).toEqual(["2", "1", "3"]);
  });
});

describe("formatCourseCount", () => {
  test("uses the spec's '{n} curso(s)'", () => {
    expect(formatCourseCount(0)).toBe("0 curso(s)");
    expect(formatCourseCount(3)).toBe("3 curso(s)");
  });
});
