import { describe, expect, test } from "bun:test";

import {
  institutionLocation,
  formatCreatedDate,
  institutionSubtitle,
  locationOrDash,
  valueOrDash,
} from "./institution-format";

describe("institutionLocation", () => {
  test("joins what is filled in", () => {
    expect(institutionLocation({ municipality: "Cali", department: "Valle" })).toBe("Cali, Valle");
    expect(institutionLocation({ municipality: "Cali", department: null })).toBe("Cali");
    expect(institutionLocation({ municipality: " ", department: "Valle" })).toBe("Valle");
  });

  test("is null when nothing is filled in", () => {
    expect(institutionLocation({ municipality: null, department: "" })).toBeNull();
  });
});

describe("table and dialog copy", () => {
  test("the table cell falls back to a dash", () => {
    expect(locationOrDash({ municipality: null, department: null })).toBe("-");
    expect(locationOrDash({ municipality: "Cali", department: "Valle" })).toBe("Cali, Valle");
  });

  test("the subtitle carries the year and the location", () => {
    expect(
      institutionSubtitle({ academicYear: "2026", municipality: "Cali", department: "Valle" }),
    ).toBe("Año 2026 · Cali, Valle");
    expect(
      institutionSubtitle({ academicYear: "2026", municipality: null, department: null }),
    ).toBe("Año 2026 · No especificada");
  });

  test("empty optional fields read as a dash", () => {
    expect(valueOrDash(null)).toBe("-");
    expect(valueOrDash("  ")).toBe("-");
    expect(valueOrDash("Res. 12")).toBe("Res. 12");
  });
});

describe("formatCreatedDate", () => {
  test("reads dd/mm/yyyy", () => {
    expect(formatCreatedDate("2026-03-05T15:00:00Z")).toBe("05/03/2026");
    expect(formatCreatedDate(new Date("2026-12-25T15:00:00Z"))).toBe("25/12/2026");
  });
});
