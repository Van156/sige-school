import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";

import {
  attendanceCalendarInput,
  attendanceExportInput,
  attendanceOfferingInput,
  attendanceReportInput,
  attendanceSaveInput,
  attendanceSheetInput,
  attendanceStudentInput,
} from "./attendance";

function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (byField[issue.path.join(".")] ??= []).push(issue.message);
  }
  return byField;
}

const record = (overrides: Record<string, unknown> = {}) => ({
  studentId: "s1",
  status: "presente",
  ...overrides,
});

const save = (records: unknown[], extra: Record<string, unknown> = {}) => ({
  offeringId: "o1",
  date: "2026-10-09",
  records,
  ...extra,
});

describe("attendanceSheetInput (ATT-01)", () => {
  test("the date is optional (the service defaults to today in Bogotá)", () => {
    expect(attendanceSheetInput.parse({ offeringId: "o1" })).toEqual({ offeringId: "o1" });
    expect(attendanceSheetInput.parse({ offeringId: "o1", date: "2026-10-09" })).toEqual({
      offeringId: "o1",
      date: "2026-10-09",
    });
  });

  test("a malformed date is rejected, a future one is not (ATT-R3 is service-side)", () => {
    expect(issues(attendanceSheetInput, { offeringId: "o1", date: "09/10/2026" })).toEqual({
      date: ["Fecha inválida"],
    });
    expect(issues(attendanceSheetInput, { offeringId: "o1", date: "2099-01-01" })).toEqual({});
    expect(Object.keys(issues(attendanceSheetInput, {}))).toEqual(["offeringId"]);
  });
});

describe("attendanceSaveInput (ATT-R2, ATT-R3, ATT-R9)", () => {
  test("trims the observation and turns a blank or missing one into null", () => {
    expect(
      attendanceSaveInput.parse(
        save([
          record({ observation: "  Llegó sin uniforme  " }),
          record({ studentId: "s2", status: "ausente", observation: "   " }),
          record({ studentId: "s3", status: "justificado", observation: null }),
          record({ studentId: "s4", status: "excusado" }),
        ]),
      ),
    ).toEqual({
      offeringId: "o1",
      date: "2026-10-09",
      records: [
        { studentId: "s1", status: "presente", observation: "Llegó sin uniforme" },
        { studentId: "s2", status: "ausente", observation: null },
        { studentId: "s3", status: "justificado", observation: null },
        { studentId: "s4", status: "excusado", observation: null },
      ],
    });
  });

  test("an observation over 300 characters (ATT-R9)", () => {
    expect(issues(attendanceSaveInput, save([record({ observation: "x".repeat(301) })]))).toEqual({
      "records.0.observation": ["La observación no puede superar 300 caracteres."],
    });
    expect(issues(attendanceSaveInput, save([record({ observation: "x".repeat(300) })]))).toEqual(
      {},
    );
  });

  test('a status outside the four values -> "Datos inválidos"', () => {
    for (const status of ["tarde", "", "Presente", 1, null]) {
      expect(issues(attendanceSaveInput, save([record({ status })]))).toEqual({
        "records.0.status": ["Datos inválidos"],
      });
    }
  });

  test("1..200 records", () => {
    expect(issues(attendanceSaveInput, save([]))).toEqual({
      records: ["No hay estudiantes para registrar"],
    });
    const many = Array.from({ length: 201 }, (_, index) => record({ studentId: `s${index}` }));
    expect(issues(attendanceSaveInput, save(many))).toEqual({
      records: ["No se pueden registrar más de 200 estudiantes a la vez."],
    });
    expect(issues(attendanceSaveInput, save(many.slice(0, 200)))).toEqual({});
  });

  test("the same student twice in one request is rejected (ATT-R2)", () => {
    expect(issues(attendanceSaveInput, save([record(), record({ status: "ausente" })]))).toEqual({
      "records.1": ["La planilla tiene estudiantes repetidos."],
    });
  });

  test('a missing date -> "Faltan datos requeridos", a malformed one -> "Fecha inválida"', () => {
    expect(issues(attendanceSaveInput, { offeringId: "o1", records: [record()] })).toEqual({
      date: ["Faltan datos requeridos"],
    });
    expect(issues(attendanceSaveInput, save([record()], { date: "2026-02-29" }))).toEqual({
      date: ["Fecha inválida"],
    });
    expect(issues(attendanceSaveInput, save([record()], { date: "2026-10-10" }))).toEqual({});
  });

  test("ids are required", () => {
    expect(
      Object.keys(
        issues(attendanceSaveInput, save([record({ studentId: "" })], { offeringId: "" })),
      ).sort(),
    ).toEqual(["offeringId", "records.0.studentId"]);
  });
});

describe("attendanceReportInput (ATT-R6)", () => {
  const range = (from: string, to: string) => ({ offeringId: "o1", from, to });

  test("an inclusive range of at most 366 days", () => {
    expect(attendanceReportInput.parse(range("2026-09-10", "2026-10-10"))).toEqual({
      offeringId: "o1",
      from: "2026-09-10",
      to: "2026-10-10",
    });
    expect(issues(attendanceReportInput, range("2026-01-01", "2026-12-31"))).toEqual({});
    expect(issues(attendanceReportInput, range("2024-01-01", "2024-12-31"))).toEqual({});
  });

  test("from after to", () => {
    expect(issues(attendanceReportInput, range("2026-10-11", "2026-10-10"))).toEqual({
      from: ["La fecha inicial no puede ser posterior a la final."],
    });
  });

  test("over a year: 366 days pass, 367 do not", () => {
    expect(issues(attendanceReportInput, range("2026-01-01", "2027-01-01"))).toEqual({});
    expect(issues(attendanceReportInput, range("2026-01-01", "2027-01-02"))).toEqual({
      to: ["El rango no puede superar un año."],
    });
  });

  test("malformed bounds report the date message once each", () => {
    expect(issues(attendanceReportInput, range("ayer", "hoy"))).toEqual({
      from: ["Fecha inválida"],
      to: ["Fecha inválida"],
    });
  });
});

describe("attendanceCalendarInput (07 §4.1, PAR-03)", () => {
  test("the month is optional and must be YYYY-MM", () => {
    expect(attendanceCalendarInput.parse({ studentId: "s1" })).toEqual({ studentId: "s1" });
    expect(attendanceCalendarInput.parse({ studentId: "s1", month: "2026-10" })).toEqual({
      studentId: "s1",
      month: "2026-10",
    });
    for (const month of ["2026-13", "2026-1", "2026-10-01", "octubre"]) {
      expect(issues(attendanceCalendarInput, { studentId: "s1", month })).toEqual({
        month: ["Mes inválido."],
      });
    }
  });
});

describe("attendanceExportInput (07 §4.1)", () => {
  test("the three variants of the export union", () => {
    expect(attendanceExportInput.parse({ kind: "student", studentId: "s1" })).toEqual({
      kind: "student",
      studentId: "s1",
    });
    expect(attendanceExportInput.parse({ kind: "group", offeringId: "o1" })).toEqual({
      kind: "group",
      offeringId: "o1",
    });
    expect(
      attendanceExportInput.parse({
        kind: "report",
        offeringId: "o1",
        from: "2026-09-10",
        to: "2026-10-10",
      }),
    ).toEqual({ kind: "report", offeringId: "o1", from: "2026-09-10", to: "2026-10-10" });
  });

  test("the report variant keeps the ATT-R6 range rules", () => {
    expect(
      issues(attendanceExportInput, {
        kind: "report",
        offeringId: "o1",
        from: "2026-10-11",
        to: "2026-10-10",
      }),
    ).toEqual({ from: ["La fecha inicial no puede ser posterior a la final."] });
  });

  test("an unknown kind is rejected", () => {
    expect(attendanceExportInput.safeParse({ kind: "roll", offeringId: "o1" }).success).toBe(false);
    expect(attendanceExportInput.safeParse({ kind: "group", studentId: "s1" }).success).toBe(false);
  });
});

describe("the remaining inputs", () => {
  test("groupSummary takes an offering, studentSummary a student", () => {
    expect(attendanceOfferingInput.parse({ offeringId: "o1" })).toEqual({ offeringId: "o1" });
    expect(attendanceStudentInput.parse({ studentId: "s1" })).toEqual({ studentId: "s1" });
    expect(Object.keys(issues(attendanceStudentInput, {}))).toEqual(["studentId"]);
  });

  test("no input carries an organizationId (R3.2)", () => {
    for (const schema of [
      attendanceSheetInput,
      attendanceSaveInput,
      attendanceOfferingInput,
      attendanceReportInput,
      attendanceStudentInput,
      attendanceCalendarInput,
    ]) {
      expect(Object.keys(schema.shape)).not.toContain("organizationId");
    }
  });
});
