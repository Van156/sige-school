import {
  COURSE_CAPACITY_MAX,
  COURSE_CAPACITY_MIN,
  isValidCriterionWeight,
  PERIOD_ORDER_MAX,
  PERIOD_ORDER_MIN,
} from "@base-template/sige-core";
import { z } from "zod";

/**
 * Input fragments for module 02 (sige/02 §4.1). Messages are the verbatim Spanish strings the UI
 * shows; the server returns the same text as field issues. No fragment carries `organizationId`
 * (INS-R12): the tenant always comes from the session.
 */

const text = (max: number, requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(max, `No puede superar ${max} caracteres.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `No puede superar ${max} caracteres.`)
    .transform((value) => (value === "" ? undefined : value))
    .optional();

const academicYear = (message: string) => z.string({ error: message }).regex(/^\d{4}$/, message);

/** `YYYY-MM-DD` that exists in the calendar (rejects 2026-02-31, 2025-02-29, month 13). */
function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const isoDate = (message: string) => z.string({ error: message }).refine(isCalendarDate, message);

/**
 * Optional field with a format check: "" (after trim) is absent, so a blank form input never
 * trips the format rule. The outer `.optional()` keeps the key itself optional.
 */
const optionalFormatted = (format: z.ZodType<string, string>) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(format.optional())
    .optional();

const JORNADA_MESSAGE = "Debes seleccionar una jornada";
export const jornadaSchema = z.enum(["manana", "tarde", "completa"], { error: JORNADA_MESSAGE });

export const courseShiftSchema = z.enum(["Mañana", "Tarde", "Nocturna", "Única", "Sabatina"], {
  error: "Debes seleccionar una jornada",
});

const NIT_PATTERN = /^[0-9.-]{5,20}$/;

export const profileInput = z.object({
  name: text(150, "El nombre de la institución es obligatorio."),
  nit: optionalFormatted(
    z
      .string()
      .regex(NIT_PATTERN, "El NIT debe tener entre 5 y 20 caracteres (dígitos, puntos o guion)."),
  ),
  address: optionalText(200),
  phone: optionalText(20),
  email: optionalFormatted(z.email("Ingresa un correo válido.").max(100)),
  municipality: optionalText(100),
  department: optionalText(100),
  resolution: optionalText(100),
  academicYear: academicYear("El año lectivo es obligatorio."),
});

export const campusInput = z.object({
  name: text(150, "El nombre de la sede es obligatorio."),
  code: optionalText(20),
  address: optionalText(200),
  jornada: jornadaSchema,
  isMain: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const levelInput = z.object({
  campusId: z.string().min(1),
  name: text(50, "El nombre del nivel es obligatorio."),
  orderNum: z
    .number({ error: "El orden debe ser un entero desde 0." })
    .int("El orden debe ser un entero desde 0.")
    .min(0, "El orden debe ser un entero desde 0.")
    .default(0),
});

export const courseInput = z.object({
  campusId: z.string().min(1),
  levelId: z.string().min(1).nullish(),
  directorPersonId: z.string().min(1).nullish(),
  name: text(50, "El nombre del grado es obligatorio."),
  academicYear: academicYear("El año lectivo es obligatorio."),
  shift: courseShiftSchema,
  maxStudents: z
    .number({ error: "La capacidad debe estar entre 1 y 60." })
    .int("La capacidad debe estar entre 1 y 60.")
    .min(COURSE_CAPACITY_MIN, "La capacidad debe estar entre 1 y 60.")
    .max(COURSE_CAPACITY_MAX, "La capacidad debe estar entre 1 y 60.")
    .default(40),
});

export const subjectInput = z.object({
  name: text(100, "El nombre de la asignatura es obligatorio."),
  code: optionalText(20),
});

const PERIOD_ORDER_FLOOR = "El orden debe ser un entero desde 1.";

export const periodInput = z
  .object({
    academicYear: academicYear("El año académico es obligatorio."),
    orderNum: z
      .number({ error: PERIOD_ORDER_FLOOR })
      .int(PERIOD_ORDER_FLOOR)
      .min(PERIOD_ORDER_MIN, PERIOD_ORDER_FLOOR)
      .max(
        PERIOD_ORDER_MAX,
        `El orden debe estar entre ${PERIOD_ORDER_MIN} y ${PERIOD_ORDER_MAX}.`,
      ),
    name: text(50, "El nombre del periodo es obligatorio."),
    shortName: text(10, "El nombre corto es obligatorio."),
    startDate: isoDate("La fecha de inicio es obligatoria."),
    endDate: isoDate("La fecha de fin es obligatoria."),
    isActive: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    // The DB check is strict (start < end); skip when either date already failed its own rule.
    if (value.startDate && value.endDate && value.endDate <= value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fecha de fin debe ser posterior a la de inicio.",
      });
    }
  });

const WEIGHT_RANGE = "El peso debe ser mayor a 0 y menor o igual a 100.";

export const criterionInput = z.object({
  name: text(100, "El nombre del criterio es obligatorio."),
  weight: z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? "El peso es obligatorio."
          : "El peso debe ser un número válido.",
    })
    .refine(Number.isFinite, "El peso debe ser un número válido.")
    .refine(isValidCriterionWeight, WEIGHT_RANGE),
  description: optionalText(300),
  orderNum: z
    .number({ error: "El orden debe ser un entero desde 1." })
    .int("El orden debe ser un entero desde 1.")
    .min(1, "El orden debe ser un entero desde 1."),
});
