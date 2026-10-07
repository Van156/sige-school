import { describe, expect, test } from "bun:test";

import { applyClientList } from "@/shared/lib/data-table/client-list";

import type { InstitutionRow } from "../types";
import {
  institutionsAccessors,
  institutionsSearchSchema,
  toInstitutionsListState,
} from "./institutions-list";

const rows: InstitutionRow[] = [
  {
    id: "1",
    name: "Colegio Sol",
    slug: "colegio-sol",
    createdAt: "2026-01-01T00:00:00.000Z",
    rector: { userId: "u1", name: "Marta Gómez", username: "mgomez3456" },
  },
  {
    id: "2",
    name: "Colegio Luna",
    slug: "colegio-luna",
    createdAt: "2026-03-01T00:00:00.000Z",
    rector: null,
  },
];

describe("institutions client list", () => {
  test("defaults to newest first", () => {
    const state = toInstitutionsListState(institutionsSearchSchema.parse({}));
    const { rows: visible, total } = applyClientList(rows, state, institutionsAccessors);
    expect(visible.map((row) => row.id)).toEqual(["2", "1"]);
    expect(total).toBe(2);
  });

  test("filters by name, case-insensitively", () => {
    const search = institutionsSearchSchema.parse({ name: "sol" });
    const { rows: visible } = applyClientList(
      rows,
      toInstitutionsListState(search),
      institutionsAccessors,
    );
    expect(visible.map((row) => row.id)).toEqual(["1"]);
  });
});
