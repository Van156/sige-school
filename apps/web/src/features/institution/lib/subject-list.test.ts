import { describe, expect, test } from "bun:test";

import { applyClientList } from "@/shared/lib/data-table/client-list";

import type { SubjectRow } from "../types";
import { subjectAccessors, subjectSearchSchema, toSubjectListState } from "./subject-list";

const rows: SubjectRow[] = [
  { id: "1", name: "Ciencias Naturales", code: "CN" },
  { id: "2", name: "Matemáticas", code: "MAT" },
  { id: "3", name: "Artes", code: null },
];

const list = (search: Record<string, unknown>) =>
  applyClientList(
    rows,
    toSubjectListState(subjectSearchSchema.parse(search)),
    subjectAccessors,
  ).rows.map((row) => row.id);

describe("subject client list", () => {
  test("keeps the server order until the user sorts", () => {
    expect(list({})).toEqual(["1", "2", "3"]);
  });

  test("filters by name and by code", () => {
    expect(list({ name: "mat" })).toEqual(["2"]);
    expect(list({ code: "cn" })).toEqual(["1"]);
  });

  test("sorts a missing code first", () => {
    expect(list({ sort: [{ id: "code", desc: false }] })).toEqual(["3", "1", "2"]);
  });
});
