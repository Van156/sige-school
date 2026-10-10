import type { SlotCell, WeeklySchedule } from "@base-template/sige-core";
import { z } from "zod";

import type { NavKind } from "@/app/navigation";

/** Which SCH-11 variant a caller sees (sige/04 SCH-R1): decided by the `me.get` kind. */
export type ScheduleAudience = "manager" | "teacher" | "student" | "none";

/**
 * Teachers read their own grid, students their course, parents and viewers have no schedule;
 * everyone else (owner, admin, coordinator, custom roles, a platform user without a person) is a
 * manager gated by `schedule:read`.
 */
export function scheduleAudience(kind: NavKind | null): ScheduleAudience {
  switch (kind) {
    case "teacher":
      return "teacher";
    case "student":
      return "student";
    case "parent":
    case "viewer":
      return "none";
    default:
      return "manager";
  }
}

const DESCRIPTIONS: Record<ScheduleAudience, string> = {
  manager: "Horario semanal por grado",
  teacher: "Tus clases de la semana",
  student: "Horario semanal de tu grado",
  none: "",
};

export function scheduleDescription(audience: ScheduleAudience): string {
  return DESCRIPTIONS[audience];
}

/** `validateSearch` of `/horarios`: the manager's course filter. An invalid value is dropped. */
export const scheduleSearchSchema = z.object({
  courseId: z.string().min(1).optional().catch(undefined),
});

export type ScheduleSearch = z.infer<typeof scheduleSearchSchema>;

/** The course the manager grid shows: the requested one when it exists, else the first. */
export function resolveCourseId(
  courses: readonly { id: string }[],
  requested: string | undefined,
): string | undefined {
  return courses.find((course) => course.id === requested)?.id ?? courses[0]?.id;
}

/** Whether any weekday holds a class (a grid of only empty block rows is "no schedule"). */
export function hasScheduledClasses(schedule: WeeklySchedule): boolean {
  return schedule.rows.some((row) => row.cells.some((cell) => cell !== null));
}

/** What the shared delete flow reports for a slot, e.g. "No se pudo eliminar la clase de Inglés". */
export function slotDeleteName(cell: SlotCell): string {
  return `la clase de ${cell.subjectName}`;
}

export const REMOVE_SLOT_QUESTION = "¿Quitar esta clase del horario?";
export const REMOVE_SLOT_SUCCESS = "Clase eliminada del horario";
