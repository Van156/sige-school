import { institutionListConfig } from "@base-template/api/lib/institution-list-config";
import { describe, expect, test } from "bun:test";

import {
  hasNoInstitutions,
  institutionSearchConfig,
  institutionSearchDefaults,
  institutionSearchSchema,
  selectorTruncationNotice,
  toInstitutionListInput,
  toSelectorListInput,
} from "./institution-list";

describe("institution search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...institutionSearchConfig.columnIds]).toEqual([
      ...institutionListConfig.sortableColumns,
    ]);
    expect([...institutionSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(institutionListConfig.filterableColumns).sort(),
    );
  });

  test("the default sort is the server's: newest first", () => {
    expect(institutionSearchConfig.defaultSort).toEqual([...institutionListConfig.defaultSort]);
  });

  test("defaults: 20 per page, no filters", () => {
    expect(institutionSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("institutionSearchSchema", () => {
  test("keeps text filters, sort and paging", () => {
    expect(
      institutionSearchSchema.parse({
        name: "san",
        nit: "900",
        municipality: "Cali",
        sort: [{ id: "campuses", desc: true }],
        page: 2,
      }),
    ).toMatchObject({
      name: "san",
      nit: "900",
      municipality: "Cali",
      sort: [{ id: "campuses", desc: true }],
      page: 2,
    });
  });

  test("drops a sort column the server would reject", () => {
    expect(institutionSearchSchema.parse({ sort: [{ id: "slug", desc: false }] }).sort).toEqual(
      institutionSearchDefaults.sort,
    );
  });
});

describe("toInstitutionListInput", () => {
  test("turns the text filters into list-input filters", () => {
    const input = toInstitutionListInput(
      institutionSearchSchema.parse({ name: "san", municipality: "Cali" }),
    );
    expect(input).toMatchObject({ page: 1, perPage: 20, joinOperator: "and" });
    expect(input.filters?.map((filter) => [filter.id, filter.value, filter.operator])).toEqual([
      ["name", "san", "iLike"],
      ["municipality", "Cali", "iLike"],
    ]);
  });
});

describe("hasNoInstitutions", () => {
  test("needs a settled stats total of zero", () => {
    expect(hasNoInstitutions(undefined)).toBe(false);
    expect(hasNoInstitutions({ institutions: 0 })).toBe(true);
    expect(hasNoInstitutions({ institutions: 2 })).toBe(false);
  });
});

describe("toSelectorListInput", () => {
  test("a blank term lists by name with no filter", () => {
    expect(toSelectorListInput("  ")).toMatchObject({
      page: 1,
      perPage: 100,
      sort: [{ id: "name", desc: false }],
      filters: [],
    });
  });

  test("a term becomes the INS-01 name text filter", () => {
    const input = toSelectorListInput(" san ");
    expect(input.filters?.map((filter) => [filter.id, filter.value, filter.operator])).toEqual([
      ["name", "san", "iLike"],
    ]);
  });
});

describe("selectorTruncationNotice", () => {
  test("is silent when every match is listed", () => {
    expect(selectorTruncationNotice(5, 5)).toBeNull();
  });

  test("tells how many of the total are shown", () => {
    expect(selectorTruncationNotice(100, 130)).toBe(
      "Mostrando 100 de 130 instituciones. Usa la búsqueda para encontrar otras.",
    );
  });
});
