import { COURSE_SHIFTS } from "@base-template/api/lib/course-list-config";
import { courseInput } from "@base-template/api/sige/schemas/institution";
import { z } from "zod";

import type { Option } from "@/shared/lib/data-table/types";

import type { CourseRow, LevelRow } from "../types";

const CAMPUS_REQUIRED = "Debes seleccionar una sede.";
const DEFAULT_CAPACITY = "40";

/**
 * INS-12 form rules. The API's own fragments carry the messages; the campus has a client-only
 * "required" message, the level is optional (blank = none) and the capacity is parsed from the
 * number input's text (blank = the default 40) before the API rule checks 1–60.
 */
export const courseFormSchema = z
  .object({
    campusId: z.string().min(1, CAMPUS_REQUIRED),
    levelId: z.string(),
    name: courseInput.shape.name,
    academicYear: courseInput.shape.academicYear,
    shift: courseInput.shape.shift,
    maxStudents: z
      .string()
      .trim()
      .transform((value) => Number(value === "" ? DEFAULT_CAPACITY : value))
      .pipe(courseInput.shape.maxStudents.removeDefault()),
  })
  .transform((values) => ({ ...values, levelId: values.levelId === "" ? null : values.levelId }));

/** Form state: every control holds a string; the selects hold an id/value or "". */
export type CourseFormValues = z.input<typeof courseFormSchema>;

/** The validated form: the shape `course.create` takes (no director: D2). */
export type CourseInput = z.output<typeof courseFormSchema>;

/** INS-12 defaults: the institution's year, "Mañana", capacity 40. */
export function emptyCourseForm(academicYear: string): CourseFormValues {
  return {
    campusId: "",
    levelId: "",
    name: "",
    academicYear,
    shift: "Mañana",
    maxStudents: DEFAULT_CAPACITY,
  };
}

/** Names of the fields the course form renders. */
export const COURSE_FIELDS = [
  "name",
  "campusId",
  "levelId",
  "academicYear",
  "shift",
  "maxStudents",
] as const;

export function courseToFormValues(course: CourseRow): CourseFormValues {
  return {
    campusId: course.campusId,
    levelId: course.levelId ?? "",
    name: course.name,
    academicYear: course.academicYear,
    shift: course.shift,
    maxStudents: String(course.maxStudents),
  };
}

export function toCourseInput(values: CourseFormValues): CourseInput {
  return courseFormSchema.parse(values);
}

/**
 * `course.update` replaces the whole row and the form has no director select yet (D2), so the
 * course's current director is sent back unchanged; omitting it would clear it.
 */
export function toCourseUpdate(
  input: CourseInput,
  course: Pick<CourseRow, "directorPersonId">,
): CourseInput & { directorPersonId: string | null } {
  return { ...input, directorPersonId: course.directorPersonId };
}

export const COURSE_SAVE_FALLBACK = "No se pudo guardar el grado. Intente nuevamente.";

/** Server messages that belong under a specific course field (sige/02 §4.1). */
export const COURSE_FIELD_BY_MESSAGE: Readonly<Record<string, keyof CourseFormValues>> = {
  "Ya existe un grado con la misma sede, nombre, año y jornada.": "name",
  "El nivel no pertenece a la sede seleccionada.": "levelId",
  "La sede no existe.": "campusId",
};

export const SHIFT_OPTIONS: Option[] = COURSE_SHIFTS.map((shift) => ({
  value: shift,
  label: shift,
}));

/** The level select's choices: only the chosen campus's levels, labelled "{nivel} ({sede})". */
export function levelChoices(levels: readonly LevelRow[], campusId: string): Option[] {
  return levels
    .filter((level) => level.campusId === campusId)
    .map((level) => ({ value: level.id, label: `${level.name} (${level.campusName})` }));
}

/** The level to keep after the campus select changed: the current one only if it still belongs. */
export function levelAfterCampusChange(
  levelId: string,
  campusId: string,
  levels: readonly LevelRow[],
): string {
  return levels.some((level) => level.id === levelId && level.campusId === campusId) ? levelId : "";
}
