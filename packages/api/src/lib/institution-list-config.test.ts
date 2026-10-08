import { describe, expect, test } from "bun:test";

import { institutionListConfig } from "./institution-list-config";
import { createListInput } from "./list-input";

const input = createListInput(institutionListConfig);

describe("institutionListConfig", () => {
  test("defaults to newest first", () => {
    expect(input.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
  });

  test("sorts by the INS-01 columns and by nothing else", () => {
    for (const id of [
      "name",
      "nit",
      "municipality",
      "academicYear",
      "campuses",
      "students",
      "createdAt",
    ]) {
      expect(input.safeParse({ sort: [{ id, desc: false }] }).success).toBe(true);
    }
    expect(input.safeParse({ sort: [{ id: "slug", desc: false }] }).success).toBe(false);
  });

  test("filters name, nit and municipality as text only", () => {
    const text = (id: string) => ({
      filters: [{ id, variant: "text", operator: "iLike", value: "x" }],
    });
    for (const id of ["name", "nit", "municipality"]) {
      expect(input.safeParse(text(id)).success).toBe(true);
    }
    expect(input.safeParse(text("campuses")).success).toBe(false);
  });
});
