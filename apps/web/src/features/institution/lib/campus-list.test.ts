import { describe, expect, test } from "bun:test";

import { applyClientList } from "@/shared/lib/data-table/client-list";

import type { CampusRow } from "../types";
import {
  campusAccessors,
  campusSearchSchema,
  summarizeCampuses,
  toCampusListState,
} from "./campus-list";

function campus(overrides: Partial<CampusRow> & { id: string; name: string }): CampusRow {
  return {
    code: null,
    address: null,
    jornada: "completa",
    isMain: false,
    active: true,
    createdAt: "2026-01-01",
    courseCount: 0,
    ...overrides,
  };
}

const rows = [
  campus({ id: "1", name: "Sede Principal", isMain: true, courseCount: 4 }),
  campus({ id: "2", name: "Sede Norte", jornada: "manana", courseCount: 1 }),
  campus({ id: "3", name: "Sede Rural", jornada: "tarde", active: false }),
];

describe("summarizeCampuses", () => {
  test("counts totals, active and inactive and names the main campus", () => {
    expect(summarizeCampuses(rows)).toEqual({
      total: 3,
      active: 2,
      inactive: 1,
      mainName: "Sede Principal",
    });
  });

  test("has no main campus name for an empty or unflagged list", () => {
    expect(summarizeCampuses([])).toEqual({ total: 0, active: 0, inactive: 0, mainName: null });
    expect(summarizeCampuses([rows[1]!]).mainName).toBeNull();
  });
});

describe("campus client list", () => {
  const list = (search: Record<string, unknown>) =>
    applyClientList(
      rows,
      toCampusListState(campusSearchSchema.parse(search)),
      campusAccessors,
    ).rows.map((row) => row.id);

  test("keeps the server order until the user sorts", () => {
    expect(list({})).toEqual(["1", "2", "3"]);
  });

  test("filters by name text, jornada and status", () => {
    expect(list({ name: "norte" })).toEqual(["2"]);
    expect(list({ jornada: "tarde" })).toEqual(["3"]);
    expect(list({ status: "inactive" })).toEqual(["3"]);
    expect(list({ status: "active", jornada: "completa" })).toEqual(["1"]);
  });

  test("sorts by course count", () => {
    expect(list({ sort: [{ id: "courseCount", desc: true }] })).toEqual(["1", "2", "3"]);
    expect(list({ sort: [{ id: "name", desc: false }] })).toEqual(["2", "1", "3"]);
  });
});
