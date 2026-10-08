import { describe, expect, test } from "bun:test";

import {
  emptyPeriodForm,
  isOverlapMessage,
  mapPeriodSubmitError,
  periodFormSchema,
  periodToFormValues,
  planPeriodSave,
  toPeriodInput,
} from "./period-form";

const valid = {
  ...emptyPeriodForm("2026", false),
  name: " Primer Periodo ",
  shortName: "P1",
  startDate: "2026-01-20",
  endDate: "2026-03-31",
};

function messages(values: Parameters<typeof periodFormSchema.safeParse>[0]) {
  const result = periodFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("period form", () => {
  test("defaults to the institution year, order 1, active only for the first period", () => {
    expect(emptyPeriodForm("2026", true)).toMatchObject({
      academicYear: "2026",
      orderNum: "1",
      isActive: true,
    });
    expect(emptyPeriodForm("2026", false).isActive).toBe(false);
  });

  test("turns the order text into a number and trims names", () => {
    expect(toPeriodInput({ ...valid, orderNum: "2" })).toMatchObject({
      name: "Primer Periodo",
      orderNum: 2,
    });
  });

  test("shows the API messages for order bounds and blanks", () => {
    expect(messages({ ...valid, orderNum: "0" })).toEqual(["El orden debe ser un entero desde 1."]);
    expect(messages({ ...valid, orderNum: "5" })).toEqual(["El orden debe estar entre 1 y 4."]);
    expect(messages({ ...valid, orderNum: "" })).toEqual(["El orden debe ser un entero desde 1."]);
  });

  test("requires the dates and an end after the start, on the end date", () => {
    expect(messages({ ...valid, startDate: "" })).toEqual(["La fecha de inicio es obligatoria."]);
    const result = periodFormSchema.safeParse({ ...valid, endDate: "2026-01-20" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message: "La fecha de fin debe ser posterior a la de inicio.",
      path: ["endDate"],
    });
  });

  test("round-trips an existing period into form values", () => {
    const values = periodToFormValues({
      id: "p1",
      academicYear: "2026",
      orderNum: 3,
      name: "Tercer Periodo",
      shortName: "P3",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      isActive: true,
    });
    expect(values.orderNum).toBe("3");
    expect(toPeriodInput(values).orderNum).toBe(3);
  });
});

describe("planPeriodSave", () => {
  const active = toPeriodInput({ ...valid, isActive: true });

  test("sends a newly activated period inactive and activates it afterwards", () => {
    expect(planPeriodSave(active, false)).toEqual({
      input: { ...active, isActive: false },
      activateAfter: true,
    });
  });

  test("keeps an already active period as it is", () => {
    expect(planPeriodSave(active, true)).toEqual({ input: active, activateAfter: false });
  });

  test("never activates when the switch is off", () => {
    const inactive = toPeriodInput(valid);
    expect(planPeriodSave(inactive, false).activateAfter).toBe(false);
    expect(planPeriodSave(inactive, true).activateAfter).toBe(false);
  });
});

describe("mapPeriodSubmitError", () => {
  test("puts the overlap conflict under both dates", () => {
    const message = "Las fechas se superponen con el periodo Primer Periodo.";
    expect(isOverlapMessage(message)).toBe(true);
    expect(mapPeriodSubmitError({ code: "CONFLICT", message })).toEqual({
      fieldErrors: { startDate: message, endDate: message },
      formError: null,
    });
  });

  test("maps the unique conflicts and the keep-one-active rule to their fields", () => {
    expect(
      mapPeriodSubmitError({
        code: "CONFLICT",
        message: "Ya existe un periodo con este nombre corto en el año.",
      }).fieldErrors,
    ).toEqual({ shortName: "Ya existe un periodo con este nombre corto en el año." });
    expect(
      mapPeriodSubmitError({
        code: "BAD_REQUEST",
        message: "Debe haber un periodo activo. Active otro periodo para cambiar.",
      }).fieldErrors,
    ).toEqual({ isActive: "Debe haber un periodo activo. Active otro periodo para cambiar." });
  });

  test("falls back for unknown failures", () => {
    expect(mapPeriodSubmitError(new Error("offline")).formError).toBe(
      "No se pudo guardar el periodo. Intente nuevamente.",
    );
  });
});
