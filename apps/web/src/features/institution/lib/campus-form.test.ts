import { describe, expect, test } from "bun:test";

import {
  campusFormSchema,
  campusToFormValues,
  emptyCampusForm,
  JORNADA_OPTIONS,
  toCampusInput,
} from "./campus-form";

describe("toCampusInput", () => {
  test("trims text and omits blank optional fields", () => {
    expect(
      toCampusInput({ ...emptyCampusForm, name: "  Sede Norte ", code: "  ", address: "" }),
    ).toEqual({ name: "Sede Norte", jornada: "completa", isMain: false, active: true });
  });

  test("keeps filled optional fields and the switches", () => {
    expect(
      toCampusInput({
        name: "Sede Sur",
        code: "SS",
        address: "Calle 1",
        jornada: "tarde",
        isMain: true,
        active: false,
      }),
    ).toEqual({
      name: "Sede Sur",
      code: "SS",
      address: "Calle 1",
      jornada: "tarde",
      isMain: true,
      active: false,
    });
  });
});

describe("campusFormSchema", () => {
  test("reports the spec message for a blank name", () => {
    const result = campusFormSchema.safeParse(emptyCampusForm);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("El nombre de la sede es obligatorio.");
  });
});

describe("campusToFormValues", () => {
  test("turns null columns into blank text", () => {
    expect(
      campusToFormValues({
        id: "c1",
        name: "Sede Principal",
        code: null,
        address: null,
        jornada: "manana",
        isMain: true,
        active: true,
        createdAt: "2026-01-01",
        courseCount: 3,
      }),
    ).toEqual({
      name: "Sede Principal",
      code: "",
      address: "",
      jornada: "manana",
      isMain: true,
      active: true,
    });
  });
});

describe("JORNADA_OPTIONS", () => {
  test("lists the three jornadas with Spanish labels", () => {
    expect(JORNADA_OPTIONS.map((option) => option.label)).toEqual(["Mañana", "Tarde", "Completa"]);
  });
});
