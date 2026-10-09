import { describe, expect, test } from "bun:test";

import { profileToFormValues, toProfileInput } from "./profile-form";

const profile = {
  name: "Institución San José",
  logo: null,
  nit: null,
  phone: "3001234567",
  email: null,
  address: null,
  municipality: "Medellín",
  department: "Antioquia",
  resolution: null,
  currentAcademicYear: "2026",
  timezone: "America/Bogota",
};

describe("profileToFormValues", () => {
  test("shows the stored academic year and blanks the null columns", () => {
    expect(profileToFormValues(profile)).toEqual({
      name: "Institución San José",
      nit: "",
      phone: "3001234567",
      email: "",
      address: "",
      municipality: "Medellín",
      department: "Antioquia",
      academicYear: "2026",
      resolution: "",
    });
  });
});

describe("toProfileInput", () => {
  test("round-trips an unchanged profile, omitting the blank optionals", () => {
    expect(toProfileInput(profileToFormValues(profile))).toEqual({
      name: "Institución San José",
      phone: "3001234567",
      municipality: "Medellín",
      department: "Antioquia",
      academicYear: "2026",
    });
  });

  test("rejects a malformed NIT and a blank academic year", () => {
    const values = { ...profileToFormValues(profile), nit: "12", academicYear: "" };
    expect(() => toProfileInput(values)).toThrow();
  });
});
