import { z } from "zod";

/**
 * Input fragments for module 04 (sige/04 §4.1). Messages are the verbatim Spanish strings the UI
 * shows; the server returns the same text as field issues. No fragment carries `organizationId`
 * (R3.2): the tenant always comes from the session. Uniqueness, overlap and delete rules need the
 * database and live in the services.
 */

const requiredId = (message: string) => z.string({ error: message }).min(1, message);

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

const intRange = (min: number, max: number, message: string) =>
  z.number({ error: message }).int(message).min(min, message).max(max, message);

const SELECT_CAMPUS = "Debes seleccionar una sede.";
const SELECT_COURSE = "Debes seleccionar un grado.";
const SELECT_SUBJECT = "Debes seleccionar una materia.";
const SELECT_TEACHER = "Debes seleccionar un profesor.";
const HOURS_MESSAGE = "La intensidad debe estar entre 1 y 20 horas.";
const JSON_MESSAGE = "El formato JSON no es válido.";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const classroomTypeSchema = z.enum(["aula", "laboratorio", "auditorio", "cancha"], {
  error: "Debes seleccionar un tipo.",
});

export const timeBlockShiftSchema = z.enum(["Mañana", "Tarde", "Nocturna", "Única"], {
  error: "Debes seleccionar una jornada.",
});

export const assignmentStatusSchema = z.enum(["activo", "inactivo", "temporal"], {
  error: "Debes seleccionar un estado.",
});

/** SCH-08 create/update. `resources` is empty or a JSON object (arrays and scalars are rejected). */
export const classroomInput = z.object({
  campusId: requiredId(SELECT_CAMPUS),
  name: text(50, "El nombre es obligatorio."),
  code: text(20, "El código es obligatorio."),
  capacity: intRange(10, 100, "La capacidad debe estar entre 10 y 100.").default(40),
  floor: z
    .number({ error: "El piso debe ser 1 o mayor." })
    .int("El piso debe ser 1 o mayor.")
    .min(1, "El piso debe ser 1 o mayor.")
    .default(1),
  classroomType: classroomTypeSchema,
  building: optionalText(50),
  resources: z.record(z.string(), z.unknown(), { error: JSON_MESSAGE }).nullish(),
});

const timeField = (requiredMessage: string) =>
  z.string({ error: requiredMessage }).regex(TIME_PATTERN, requiredMessage);

/** SCH-10 create/update (the year is the institution's current year, SCH-R11). */
export const timeBlockInput = z
  .object({
    campusId: requiredId(SELECT_CAMPUS),
    name: text(50, "El nombre es obligatorio."),
    shift: timeBlockShiftSchema,
    startTime: timeField("La hora de inicio es obligatoria."),
    endTime: timeField("La hora de fin es obligatoria."),
    orderNum: z
      .number({ error: "El orden debe ser 1 o mayor." })
      .int("El orden debe ser 1 o mayor.")
      .min(1, "El orden debe ser 1 o mayor."),
    isBreak: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (TIME_PATTERN.test(value.startTime) && TIME_PATTERN.test(value.endTime)) {
      if (value.startTime >= value.endTime) {
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "La hora de fin debe ser posterior a la de inicio.",
        });
      }
    }
  });

const hoursPerWeek = intRange(1, 20, HOURS_MESSAGE);

/** SCH-06 `offering.createBulk`: at most 50 x 50 ids and 500 combinations. */
export const offeringCreateBulkInput = z
  .object({
    courseIds: z
      .array(requiredId(SELECT_COURSE))
      .min(1, "Seleccione al menos un grado.")
      .max(50, "Seleccione como máximo 50 grados."),
    subjectIds: z
      .array(requiredId(SELECT_SUBJECT))
      .min(1, "Seleccione al menos una materia.")
      .max(50, "Seleccione como máximo 50 materias."),
    teacherPersonId: z.string().min(1).nullish(),
    hoursPerWeek,
  })
  .refine((value) => value.courseIds.length * value.subjectIds.length <= 500, {
    message: "Seleccione como máximo 500 combinaciones de grado y materia.",
    path: ["subjectIds"],
  });

/** OQ-SCH-1 `offering.update`: only the weekly hours are editable. */
export const offeringUpdateInput = z.object({
  id: requiredId("La materia del grado es obligatoria."),
  hoursPerWeek,
});

/** SCH-04 `assignment.assign`. */
export const assignmentAssignInput = z.object({
  courseId: requiredId(SELECT_COURSE),
  subjectId: requiredId(SELECT_SUBJECT),
  teacherPersonId: requiredId(SELECT_TEACHER),
});

/** SCH-04 `assignment.update`: status and notes only (SCH-R3). */
export const assignmentUpdateInput = z.object({
  id: requiredId("La asignación es obligatoria."),
  status: assignmentStatusSchema,
  notes: optionalText(500),
});

/** SCH-12 `schedule.generate`: `courseId` wins over `campusId`. */
export const scheduleGenerateInput = z.object({
  campusId: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
});
