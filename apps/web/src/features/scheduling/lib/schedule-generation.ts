import type { ScheduleGenerationResult } from "../types";

/** A course the generator can target (`course.options`). */
export type GenerationCourse = { id: string; name: string; campusId: string };

/** The "Parámetros" selections; an empty string is "Todas las sedes" / "Todos los grados". */
export type GenerationParams = { campusId: string; courseId: string };

export const EMPTY_GENERATION_PARAMS: GenerationParams = { campusId: "", courseId: "" };

/** Where a generation run stands (SCH-12): checking for slots, confirming a replace, running, done. */
export type GenerationPhase =
  | { name: "idle" }
  | { name: "checking" }
  | { name: "confirming"; params: GenerationParams }
  | { name: "running" }
  | { name: "done"; result: ScheduleGenerationResult; viewCourseId: string | undefined }
  | { name: "failed" };

/**
 * Past this many target courses the "already has slots" probe (one `schedule.get` per course) is
 * skipped and the replace confirmation is always asked, which is the safe side.
 */
export const EXISTING_CHECK_LIMIT = 40;

/** Courses of active campuses only: `campus.options` lists the active ones, the generator skips the rest. */
export function generatableCourses(
  courses: readonly GenerationCourse[],
  campuses: readonly { id: string }[],
): GenerationCourse[] {
  const active = new Set(campuses.map((campus) => campus.id));
  return courses.filter((course) => active.has(course.campusId));
}

/** The "Grado (opcional)" choices: the chosen campus' courses, or all of them. */
export function coursesOfCampus(
  courses: readonly GenerationCourse[],
  campusId: string,
): GenerationCourse[] {
  return campusId ? courses.filter((course) => course.campusId === campusId) : [...courses];
}

/** The courses a run replaces: the chosen course (it wins over the campus), else the campus' or all. */
export function targetCourses(
  courses: readonly GenerationCourse[],
  params: GenerationParams,
): GenerationCourse[] {
  if (params.courseId) {
    return courses.filter((course) => course.id === params.courseId);
  }
  return coursesOfCampus(courses, params.campusId);
}

/** `schedule.generate` input: `courseId` wins over `campusId`, so only the narrowest is sent. */
export function toGenerateInput(params: GenerationParams): {
  campusId?: string;
  courseId?: string;
} {
  if (params.courseId) {
    return { courseId: params.courseId };
  }
  return params.campusId ? { campusId: params.campusId } : {};
}

/** `assigned = 0` is the "Error al generar horario" callout (sige/04 §5.4). */
export function isEmptyResult(result: ScheduleGenerationResult): boolean {
  return result.assigned === 0;
}

export const GENERATION_FAILURE_MESSAGE = "Error de conexión. Intente nuevamente.";
