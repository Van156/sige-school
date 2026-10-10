import { describe, expect, test } from "bun:test";

import {
  ABSENCE_BANDS,
  ABSENCE_BAND_LABEL,
  ABSENCE_BAND_TONE,
  ATTENDANCE_GLYPH,
  ATTENDANCE_LABEL,
  ATTENDANCE_STATUSES,
  ATTENDANCE_TONE,
  COURSE_SHIFT_SATURDAY,
  ISO_WEEKDAY,
  absenceBand,
  absenceRate,
  atRisk,
  attendanceMessages,
  attendancePct,
  byStudent,
  inclusiveDays,
  isCalendarDate,
  isCalendarMonth,
  isSchoolDay,
  isoWeekday,
  monthlyTally,
  tally,
} from "./attendance";
import { SIGE_RULES } from "./rules";

const rows = (...statuses: string[]) =>
  statuses.map((status) => ({ status: status as (typeof ATTENDANCE_STATUSES)[number] }));

/** `n` present rows and `total - n` absent rows, for exact percentage checks. */
const mix = (present: number, total: number) =>
  rows(...Array.from({ length: total }, (_, index) => (index < present ? "presente" : "ausente")));

describe("statuses, labels and tones (07 §2, §6.1)", () => {
  test("the four values of the `attendance_status` enum, in roll-sheet order", () => {
    expect(ATTENDANCE_STATUSES).toEqual(["presente", "ausente", "justificado", "excusado"]);
  });

  test('labels and glyphs: "✓ Presente", "✗ Ausente", "⚑ Justificado", "ℹ Excusado"', () => {
    expect(ATTENDANCE_LABEL).toEqual({
      presente: "Presente",
      ausente: "Ausente",
      justificado: "Justificado",
      excusado: "Excusado",
    });
    expect(ATTENDANCE_GLYPH).toEqual({
      presente: "✓",
      ausente: "✗",
      justificado: "⚑",
      excusado: "ℹ",
    });
    expect(ATTENDANCE_TONE).toEqual({
      presente: "success",
      ausente: "destructive",
      justificado: "warning",
      excusado: "info",
    });
  });

  test('bands carry the badge text "Crítico" / "Atención" / "Normal" and their tones', () => {
    expect(ABSENCE_BANDS).toEqual(["critical", "attention", "normal"]);
    expect(ABSENCE_BAND_LABEL).toEqual({
      critical: "Crítico",
      attention: "Atención",
      normal: "Normal",
    });
    expect(ABSENCE_BAND_TONE).toEqual({
      critical: "destructive",
      attention: "warning",
      normal: "success",
    });
  });
});

describe("tally (07 §3)", () => {
  test("merges justificado and excusado, counts ausente alone", () => {
    expect(tally(rows("presente", "ausente", "justificado", "excusado", "excusado"))).toEqual({
      total: 5,
      present: 1,
      absent: 1,
      justified: 3,
    });
  });

  test("empty", () => {
    expect(tally([])).toEqual({ total: 0, present: 0, absent: 0, justified: 0 });
  });
});

describe("attendancePct / absenceRate (ATT-R4, OD-7)", () => {
  test("no rows: 100 % attendance and 0 % absence", () => {
    expect(attendancePct([])).toBe(100);
    expect(absenceRate([])).toBe(0);
  });

  test("all present / all absent", () => {
    expect(attendancePct(mix(4, 4))).toBe(100);
    expect(absenceRate(mix(4, 4))).toBe(0);
    expect(attendancePct(mix(0, 4))).toBe(0);
    expect(absenceRate(mix(0, 4))).toBe(100);
  });

  test("every non-presente status is an absence (OD-7)", () => {
    const row = rows("presente", "ausente", "justificado", "excusado");
    expect(attendancePct(row)).toBe(25);
    expect(absenceRate(row)).toBe(75);
  });

  test("one decimal, half-up", () => {
    expect(attendancePct(mix(2, 3))).toBe(66.7);
    expect(absenceRate(mix(2, 3))).toBe(33.3);
    expect(attendancePct(mix(1, 3))).toBe(33.3);
  });

  test("x.x5 ties round up and the pair still sums to 100.0", () => {
    // 1/16 = 6.25 % -> 6.3; the independently rounded 93.75 % would be 93.8 (sum 100.1).
    expect(attendancePct(mix(1, 16))).toBe(6.3);
    expect(absenceRate(mix(1, 16))).toBe(93.7);
    // 7/16 = 43.75 % -> 43.8 and 9/16 = 56.25 % -> 56.3 (sum 100.1 if computed apart).
    expect(attendancePct(mix(7, 16))).toBe(43.8);
    expect(absenceRate(mix(7, 16))).toBe(56.2);
    for (const total of [3, 7, 8, 16, 24, 32, 37, 160, 800]) {
      for (let present = 0; present <= total; present += 1) {
        const sample = mix(present, total);
        expect(attendancePct(sample) + absenceRate(sample)).toBe(100);
      }
    }
  });
});

describe("absenceBand (07 §3, exclusive boundaries)", () => {
  test("20.0 is attention, 20.1 critical; 10.0 is normal, 10.1 attention", () => {
    expect(absenceBand(20.1)).toBe("critical");
    expect(absenceBand(20)).toBe("attention");
    expect(absenceBand(10.1)).toBe("attention");
    expect(absenceBand(10)).toBe("normal");
    expect(absenceBand(0)).toBe("normal");
    expect(absenceBand(100)).toBe("critical");
  });

  test("the thresholds come from SIGE_RULES", () => {
    expect(SIGE_RULES.ABSENCE_CRITICAL).toBe(20);
    expect(SIGE_RULES.ABSENCE_ATTENTION).toBe(10);
    expect(SIGE_RULES.LOW_ATTENDANCE).toBe(80);
  });
});

describe("monthlyTally (07 §3)", () => {
  test("groups by YYYY-MM ascending, across a year rollover", () => {
    expect(
      monthlyTally([
        { date: "2027-01-05", status: "presente" },
        { date: "2026-12-31", status: "ausente" },
        { date: "2026-11-02", status: "justificado" },
        { date: "2026-12-01", status: "presente" },
        { date: "2026-11-30", status: "excusado" },
      ]),
    ).toEqual([
      { month: "2026-11", total: 2, present: 0, absent: 0, justified: 2 },
      { month: "2026-12", total: 2, present: 1, absent: 1, justified: 0 },
      { month: "2027-01", total: 1, present: 1, absent: 0, justified: 0 },
    ]);
  });

  test("empty", () => {
    expect(monthlyTally([])).toEqual([]);
  });
});

describe("byStudent (07 §3, ATT-R8)", () => {
  const records = [
    { studentId: "s1", status: "presente" as const },
    { studentId: "s1", status: "presente" as const },
    { studentId: "s1", status: "ausente" as const },
    { studentId: "s2", status: "ausente" as const },
    { studentId: "s2", status: "justificado" as const },
    { studentId: "ghost", status: "ausente" as const },
  ];

  test("one row per student id, in the given order", () => {
    expect(byStudent(["s1", "s2", "s3"], records)).toEqual([
      {
        studentId: "s1",
        total: 3,
        present: 2,
        absent: 1,
        justified: 0,
        attendancePct: 66.7,
        absenceRate: 33.3,
        band: "critical",
      },
      {
        studentId: "s2",
        total: 2,
        present: 0,
        absent: 1,
        justified: 1,
        attendancePct: 0,
        absenceRate: 100,
        band: "critical",
      },
      {
        studentId: "s3",
        total: 0,
        present: 0,
        absent: 0,
        justified: 0,
        attendancePct: null,
        absenceRate: null,
        band: null,
      },
    ]);
  });

  test('students without records get null percentages ("-" and "Sin registros", ATT-R8)', () => {
    const [row] = byStudent(["s3"], records);
    expect(row).toMatchObject({ total: 0, attendancePct: null, absenceRate: null, band: null });
    expect(attendanceMessages.noRecordsBadge).toBe("Sin registros");
  });

  test("rows of students outside the list are ignored", () => {
    expect(byStudent(["s1"], records)).toHaveLength(1);
  });
});

describe("atRisk (07 §3)", () => {
  const perStudent = byStudent(
    ["a", "b", "c", "d", "e"],
    [
      // a: 1/5 absent = 20.0 % -> attention, not at risk (exclusive boundary).
      ...Array.from({ length: 4 }, () => ({ studentId: "a", status: "presente" as const })),
      { studentId: "a", status: "ausente" as const },
      // b: 2/5 = 40 %.
      ...Array.from({ length: 3 }, () => ({ studentId: "b", status: "presente" as const })),
      { studentId: "b", status: "ausente" as const },
      { studentId: "b", status: "excusado" as const },
      // c: 3/5 = 60 %.
      ...Array.from({ length: 2 }, () => ({ studentId: "c", status: "presente" as const })),
      ...Array.from({ length: 3 }, () => ({ studentId: "c", status: "ausente" as const })),
      // d: 2/5 = 40 %, ties with b.
      ...Array.from({ length: 3 }, () => ({ studentId: "d", status: "presente" as const })),
      ...Array.from({ length: 2 }, () => ({ studentId: "d", status: "ausente" as const })),
      // e: no rows.
    ],
  );

  test("only rates above 20 %, highest first, ties by student id", () => {
    expect(atRisk(perStudent).map((row) => [row.studentId, row.absenceRate])).toEqual([
      ["c", 60],
      ["b", 40],
      ["d", 40],
    ]);
  });

  test("students without records are excluded (ATT-R8)", () => {
    expect(atRisk(perStudent).map((row) => row.studentId)).not.toContain("e");
  });
});

describe("isoWeekday / isSchoolDay (ATT-R3)", () => {
  test("ISO weekdays of a known week, with no time-zone drift", () => {
    expect(isoWeekday("2026-10-05")).toBe(ISO_WEEKDAY.monday);
    expect(isoWeekday("2026-10-09")).toBe(ISO_WEEKDAY.friday);
    expect(isoWeekday("2026-10-10")).toBe(ISO_WEEKDAY.saturday);
    expect(isoWeekday("2026-10-11")).toBe(ISO_WEEKDAY.sunday);
    expect(ISO_WEEKDAY).toEqual({
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 7,
    });
  });

  test("malformed or non-existent days have no weekday", () => {
    for (const date of ["", "2026-2-3", "2026-02-29", "2026-13-01", "2026-10-32", "hoy"]) {
      expect(isoWeekday(date)).toBeNull();
      expect(isSchoolDay(date, "Mañana")).toBe(false);
    }
  });

  test("Monday–Friday for every shift, Saturday only for Sabatina, never Sunday", () => {
    const week = {
      "2026-10-05": true,
      "2026-10-06": true,
      "2026-10-07": true,
      "2026-10-08": true,
      "2026-10-09": true,
      "2026-10-10": false,
      "2026-10-11": false,
    };
    for (const shift of ["Mañana", "Tarde", "Nocturna", "Única"]) {
      for (const [date, expected] of Object.entries(week)) {
        expect(isSchoolDay(date, shift)).toBe(expected);
      }
    }
    for (const [date, expected] of Object.entries({ ...week, "2026-10-10": true })) {
      expect(isSchoolDay(date, COURSE_SHIFT_SATURDAY)).toBe(expected);
    }
    expect(COURSE_SHIFT_SATURDAY).toBe("Sabatina");
    expect(isSchoolDay("2026-10-11", "Sabatina")).toBe(false);
  });
});

describe("calendar helpers (ATT-R3, ATT-R6, 07 §4.1)", () => {
  test("isCalendarDate accepts YYYY-MM-DD days that exist", () => {
    expect(isCalendarDate("2026-10-10")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    for (const value of ["2026-02-29", "2026-10-1", "26-10-01", "2026/10/01", "", " 2026-10-01"]) {
      expect(isCalendarDate(value)).toBe(false);
    }
  });

  test("isCalendarMonth accepts YYYY-MM", () => {
    expect(isCalendarMonth("2026-10")).toBe(true);
    for (const value of ["2026-13", "2026-00", "2026-1", "2026-10-01", ""]) {
      expect(isCalendarMonth(value)).toBe(false);
    }
  });

  test("inclusiveDays counts both ends (ATT-R6: 366 is the limit)", () => {
    expect(inclusiveDays("2026-10-10", "2026-10-10")).toBe(1);
    expect(inclusiveDays("2026-10-10", "2026-10-11")).toBe(2);
    expect(inclusiveDays("2026-01-01", "2026-12-31")).toBe(365);
    expect(inclusiveDays("2024-01-01", "2024-12-31")).toBe(366);
    expect(inclusiveDays("2026-01-01", "2027-01-01")).toBe(366);
    expect(inclusiveDays("2026-01-01", "2027-01-02")).toBe(367);
    expect(inclusiveDays("2026-10-11", "2026-10-10")).toBe(0);
    expect(inclusiveDays("2026-10-11", "nope")).toBeNull();
    expect(SIGE_RULES.ATTENDANCE_REPORT_MAX_DAYS).toBe(366);
  });
});

describe("attendanceMessages (ATT-R1…R9, verbatim)", () => {
  test("every message of §5 character for character", () => {
    expect(attendanceMessages).toEqual({
      studentNotInCourse: "El estudiante no pertenece a este grado.",
      noStudents: "No hay estudiantes para registrar",
      invalidData: "Datos inválidos",
      missingData: "Faltan datos requeridos",
      invalidDate: "Fecha inválida",
      futureDate: "No se puede registrar asistencia en una fecha futura.",
      notSchoolDay: "Las clases se dictan de lunes a viernes.",
      observationTooLong: "La observación no puede superar 300 caracteres.",
      rangeInverted: "La fecha inicial no puede ser posterior a la final.",
      rangeTooLong: "El rango no puede superar un año.",
      invalidMonth: "Mes inválido.",
      offeringForbidden: "No tienes permiso para esta asignatura.",
      duplicateStudent: "La planilla tiene estudiantes repetidos.",
      tooManyRecords: "No se pueden registrar más de 200 estudiantes a la vez.",
      noRecordsBadge: "Sin registros",
    });
  });

  test("the limits behind the messages live in SIGE_RULES", () => {
    expect(SIGE_RULES.ATTENDANCE_OBSERVATION_MAX).toBe(300);
    expect(SIGE_RULES.ATTENDANCE_MAX_RECORDS).toBe(200);
    expect(attendanceMessages.observationTooLong).toContain(
      String(SIGE_RULES.ATTENDANCE_OBSERVATION_MAX),
    );
    expect(attendanceMessages.tooManyRecords).toContain(String(SIGE_RULES.ATTENDANCE_MAX_RECORDS));
  });
});
