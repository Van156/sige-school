import {
  ATTENDANCE_STATUSES,
  SIGE_RULES,
  attendanceMessages,
  inclusiveDays,
  isCalendarDate,
  isCalendarMonth,
} from "@base-template/sige-core";
import { z } from "zod";

/**
 * Inputs of the `attendance.*` procedures (sige/07 §4.1). Every message is the verbatim ATT-R2,
 * ATT-R3, ATT-R6 or ATT-R9 string, imported from `sige-core` together with its limit.
 *
 * Dates are validated by shape only (`YYYY-MM-DD`, "Fecha inválida"): "today", the future check
 * (ATT-R3 "No se puede registrar asistencia en una fecha futura.") and the school-day check need
 * the course shift and `America/Bogota` (R3.13), so they live in the services. No schema calls
 * `new Date()`. Scope, course membership and the student's status are checked against the
 * database by the services as well.
 */

const id = z.string().min(1);

/** A `YYYY-MM-DD` day that exists; a missing one is "Faltan datos requeridos" (ATT-R3). */
export const attendanceDateSchema = z
  .string({ error: attendanceMessages.missingData })
  .refine(isCalendarDate, attendanceMessages.invalidDate);

/** `attendance_status` (07 §2); anything else is "Datos inválidos" (ATT-R2). */
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES, {
  error: attendanceMessages.invalidData,
});

/** `attendance_record.observation` (ATT-R9): trimmed, ≤ 300 characters, blank or absent -> `null`. */
export const attendanceObservationSchema = z
  .string()
  .trim()
  .max(SIGE_RULES.ATTENDANCE_OBSERVATION_MAX, attendanceMessages.observationTooLong)
  .nullish()
  .transform((value) => (value === null || value === undefined || value === "" ? null : value));

/** `attendance.sheet` (ATT-01); without a date the service answers for today in Bogotá. */
export const attendanceSheetInput = z.object({
  offeringId: id,
  date: attendanceDateSchema.optional(),
});

/** One roll-sheet row; the UI sends every listed student, so a save is idempotent (ATT-R2). */
export const attendanceRecordInput = z.object({
  studentId: id,
  status: attendanceStatusSchema,
  observation: attendanceObservationSchema,
});

/** `attendance.save`: one upsert transaction over 1..200 rows of one offering × date (ATT-R2). */
export const attendanceSaveInput = z.object({
  offeringId: id,
  date: attendanceDateSchema,
  records: z
    .array(attendanceRecordInput)
    .min(1, attendanceMessages.noStudents)
    .max(SIGE_RULES.ATTENDANCE_MAX_RECORDS, attendanceMessages.tooManyRecords)
    .superRefine((records, context) => {
      const seen = new Set<string>();
      records.forEach((record, index) => {
        if (seen.has(record.studentId)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: attendanceMessages.duplicateStudent,
          });
        }
        seen.add(record.studentId);
      });
    }),
});

/** `attendance.groupSummary` (ATT-03). */
export const attendanceOfferingInput = z.object({ offeringId: id });

/** `attendance.studentSummary` and the student part of `attendance.history` (ATT-02). */
export const attendanceStudentInput = z.object({ studentId: id });

const reportRange = { offeringId: id, from: attendanceDateSchema, to: attendanceDateSchema };

/**
 * ATT-R6: both ends inclusive, `from <= to` and at most 366 days. The checks only run once both
 * ends are calendar days, so a malformed bound reports "Fecha inválida" alone.
 */
function checkReportRange(
  range: { from: string; to: string },
  context: z.core.$RefinementCtx,
): void {
  const days = inclusiveDays(range.from, range.to);
  if (days === null) return;
  if (range.from > range.to) {
    context.addIssue({ code: "custom", path: ["from"], message: attendanceMessages.rangeInverted });
    return;
  }
  if (days > SIGE_RULES.ATTENDANCE_REPORT_MAX_DAYS) {
    context.addIssue({ code: "custom", path: ["to"], message: attendanceMessages.rangeTooLong });
  }
}

/** `attendance.report` (ATT-04). */
export const attendanceReportInput = z.object(reportRange).superRefine(checkReportRange);

/** `attendance.calendar` (PAR-03); without a month the service answers the current one in Bogotá. */
export const attendanceCalendarInput = z.object({
  studentId: id,
  month: z
    .string({ error: attendanceMessages.invalidMonth })
    .refine(isCalendarMonth, attendanceMessages.invalidMonth)
    .optional(),
});

/**
 * `attendance.export` (07 §4.1): the student history, the group summary or the range report. The
 * student variant's list filters come from the shared list contract (`attendance-list-config.ts`,
 * R3.8) and are merged in by the router, not here.
 */
export const attendanceExportInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("student"), studentId: id }),
  z.object({ kind: z.literal("group"), offeringId: id }),
  z.object({ kind: z.literal("report"), ...reportRange }).superRefine(checkReportRange),
]);
