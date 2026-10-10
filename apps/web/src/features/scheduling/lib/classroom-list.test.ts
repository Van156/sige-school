import { classroomListConfig } from "@base-template/api/lib/classroom-list-config";
import { describe, expect, test } from "bun:test";

import {
  CLASSROOM_TYPE_OPTIONS,
  classroomSearchConfig,
  classroomSearchDefaults,
  classroomSearchSchema,
  formatCapacity,
  formatLocation,
  hasNoClassrooms,
  toClassroomListInput,
} from "./classroom-list";

describe("classroom search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...classroomSearchConfig.columnIds]).toEqual([...classroomListConfig.sortableColumns]);
    expect([...classroomSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(classroomListConfig.filterableColumns).sort(),
    );
  });

  test("the type choices are the server's type allowlist, in order", () => {
    expect(CLASSROOM_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      ...classroomListConfig.filterableColumns.type.options,
    ]);
    expect(CLASSROOM_TYPE_OPTIONS.map((option) => option.label)).toEqual([
      "Aula",
      "Laboratorio",
      "Auditorio",
      "Cancha",
    ]);
  });

  test("defaults: by name, 20 per page, no filters", () => {
    expect(classroomSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "name", desc: false }],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("classroomSearchSchema", () => {
  test("keeps valid simple filters, sort and paging", () => {
    const search = classroomSearchSchema.parse({
      name: "lab",
      campusId: "c1",
      type: "laboratorio",
      sort: [{ id: "capacity", desc: true }],
      page: 2,
    });
    expect(search).toMatchObject({
      name: "lab",
      campusId: "c1",
      type: "laboratorio",
      sort: [{ id: "capacity", desc: true }],
      page: 2,
    });
  });

  test("drops a type the server would reject", () => {
    expect(classroomSearchSchema.parse({ type: "piscina" })).not.toHaveProperty("type");
  });
});

describe("toClassroomListInput", () => {
  test("turns the simple filters into list-input filters", () => {
    const input = toClassroomListInput(
      classroomSearchSchema.parse({ name: "aula", campusId: "c1", type: "aula" }),
    );
    expect(input).toMatchObject({ page: 1, perPage: 20, joinOperator: "and" });
    expect(input.filters?.map((filter) => [filter.id, filter.value, filter.operator])).toEqual([
      ["name", "aula", "iLike"],
      ["campusId", "c1", "eq"],
      ["type", "aula", "eq"],
    ]);
  });
});

describe("cell formatting", () => {
  test("capacity reads as people", () => {
    expect(formatCapacity(40)).toBe("40 personas");
  });

  test("location includes the building only when there is one", () => {
    expect(formatLocation({ building: "A", floor: 2 })).toBe("Edificio A, Piso 2");
    expect(formatLocation({ building: null, floor: 1 })).toBe("Piso 1");
  });

  test("the empty state needs a settled stats total of zero", () => {
    expect(hasNoClassrooms(undefined)).toBe(false);
    expect(hasNoClassrooms({ total: 0 })).toBe(true);
    expect(hasNoClassrooms({ total: 3 })).toBe(false);
  });
});
