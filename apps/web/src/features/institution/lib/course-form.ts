import { COURSE_SHIFTS } from "@base-template/api/lib/course-list-config";
import { courseInput } from "@base-template/api/sige/schemas/institution";
import { z } from "zod";

import type { Option } from "@/shared/lib/data-table/types";

import type { CourseRow, LevelRow } from "../types";

const CAMPUS_REQUIRED = "Debes seleccionar una sede.";
const DEFAULT_CAPACITY = "40";

/**
 * INS-12 form rules. The API's own fragments carry the messages; the campus has a client-only
 * "required" message, the level and the director are optional (blank = none) and the capacity is parsed from the
 * number input's text (blank = the default 40) before the API rule checks 1–60.
 */
export const courseFormSchema = z
  .object({
    campusId: z.string().min(1, CAMPUS_REQUIRED),
    levelId: z.string(),
    directorPersonId: z.string(),
    name: courseInput.shape.name,
    academicYear: courseInput.shape.academicYear,
    shift: courseInput.shape.shift,
    maxStudents: z
      .string()
      .trim()
      .transform((value) => Number(value === "" ? DEFAULT_CAPACITY : value))
      .pipe(courseInput.shape.maxStudents.removeDefault()),
  })
  .transform((values) => ({
    ...values,
    levelId: values.levelId === "" ? null : values.levelId,
    directorPersonId: values.directorPersonId === "" ? null : values.directorPersonId,
  }));

/** Form state: every control holds a string; the selects hold an id/value or "". */
export type CourseFormValues = z.input<typeof courseFormSchema>;

/** The validated form: the shape `course.create` and `course.update` take (full replace). */
export type CourseInput = z.output<typeof courseFormSchema>;

/** INS-12 defaults: the institution's year, "Mañana", capacity 40. */
export function emptyCourseForm(academicYear: string): CourseFormValues {
  return {
    campusId: "",
    levelId: "",
    directorPersonId: "",
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
  "directorPersonId",
  "academicYear",
  "shift",
  "maxStudents",
] as const;

export function courseToFormValues(course: CourseRow): CourseFormValues {
  return {
    campusId: course.campusId,
    levelId: course.levelId ?? "",
    directorPersonId: course.directorPersonId ?? "",
    name: course.name,
    academicYear: course.academicYear,
    shift: course.shift,
    maxStudents: String(course.maxStudents),
  };
}

export function toCourseInput(values: CourseFormValues): CourseInput {
  return courseFormSchema.parse(values);
}

export const COURSE_SAVE_FALLBACK = "No se pudo guardar el grado. Intente nuevamente.";

/** Server messages that belong under a specific course field (sige/02 §4.1). */
export const COURSE_FIELD_BY_MESSAGE: Readonly<Record<string, keyof CourseFormValues>> = {
  "Ya existe un grado con la misma sede, nombre, año y jornada.": "name",
  "El nivel no pertenece a la sede seleccionada.": "levelId",
  "La sede no existe.": "campusId",
  "El director debe ser un profesor activo de la institución.": "directorPersonId",
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

/** An active teacher as `user.options` returns it. */
export type DirectorSource = { personId: string; name: string };

/** The course's current director as `course.get` reports them (active flag is server truth). */
export type CurrentDirector = Pick<
  CourseRow,
  "directorPersonId" | "directorName" | "directorActive"
>;

/** Suffix of a current director the server reports as deactivated. */
export const INACTIVE_DIRECTOR_SUFFIX = " (inactivo)";

/** The explicit choice that clears the director (form value ""). */
export const NO_DIRECTOR: Option = { value: "", label: "Sin director asignado" };

/** The current director's choice; "(inactivo)" only when the server says `directorActive: false`. */
function currentDirectorOption(current: CurrentDirector | undefined): Option | null {
  const id = current?.directorPersonId;
  if (!id) {
    return null;
  }
  const name = current.directorName ?? id;
  return {
    value: id,
    label: current.directorActive === false ? `${name}${INACTIVE_DIRECTOR_SUFFIX}` : name,
  };
}

/**
 * The director combobox's items: "Sin director asignado", then the choices that must stay
 * selectable even when the search results do not include them (the course's current director,
 * possibly deactivated or beyond the result window; the teacher just `picked`), then the
 * teachers found. Editing other fields never drops the current director: the server keeps an
 * unchanged director on update.
 */
export function directorItems(
  teachers: readonly DirectorSource[],
  current?: CurrentDirector,
  picked?: Option,
): Option[] {
  const found = teachers.map((teacher) => ({ value: teacher.personId, label: teacher.name }));
  const kept: Option[] = [];
  for (const option of [currentDirectorOption(current), picked]) {
    const known = [...found, ...kept].some((item) => item.value === option?.value);
    if (option && option.value !== NO_DIRECTOR.value && !known) {
      kept.push(option);
    }
  }
  return [NO_DIRECTOR, ...kept, ...found];
}

/** The item the form value points at; blank or unknown values select "Sin director asignado". */
export function directorSelection(items: readonly Option[], directorPersonId: string): Option {
  return items.find((item) => item.value === directorPersonId) ?? NO_DIRECTOR;
}
