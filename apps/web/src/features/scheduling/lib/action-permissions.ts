import { parsePermissionString } from "@base-template/auth/permissions";

import type { PermissionsRecord } from "@/features/access-control";

/**
 * The permission each SCH-03…12 action needs (sige/00 §4.2 grants, sige/04 §3 procedures). A link
 * names the gate of the route it opens, a button the procedure it calls; pages read `useCan` with
 * these keys and the form pages gate with the same keys, so a visible action is always one the
 * caller can use (a link to a page the caller cannot open is hidden). UX only: procedures re-check.
 */
export const SCHEDULING_ACTIONS = {
  /** SCH-05 `/materias-por-grado`. */
  offerings: {
    /** "Ver Asignaciones" → SCH-03, whose list is `assignment.list` (`offering:read`). */
    viewAssignments: "offering:read",
    /** "Asignar Materias" → SCH-06 (`offering.createBulk`). */
    assign: "offering:create",
    /** "Editar intensidad" (`offering.update`). */
    editHours: "offering:update",
    delete: "offering:delete",
  },
  /** SCH-03 `/asignaciones`: every mutation is `offering:update` (sige/04 §3.2). */
  assignments: {
    /** "Ver Materias por Grado" → SCH-05 (`offering.list`). */
    viewOfferings: "offering:read",
    create: "offering:update",
    edit: "offering:update",
    delete: "offering:update",
  },
  /** SCH-07 `/salones`. */
  classrooms: {
    create: "classroom:create",
    edit: "classroom:update",
    delete: "classroom:delete",
  },
  /** SCH-09 `/bloques`. */
  timeBlocks: {
    create: "time_block:create",
    edit: "time_block:update",
    delete: "time_block:delete",
  },
  /** SCH-11 `/horarios` and SCH-12 `/horarios/generar`. */
  schedules: {
    /** The course grid and "Ver Horario" after a generation (`schedule.get`). */
    view: "schedule:read",
    /** "Generar Horario Automático" → SCH-12 (`schedule.generate`). */
    generate: "schedule:generate",
    /** The per-cell "x" (`schedule.deleteSlot`). */
    removeSlot: "schedule:update",
  },
} as const satisfies Record<string, Record<string, `${string}:${string}`>>;

export type SchedulingScreen = keyof typeof SCHEDULING_ACTIONS;

/**
 * Which of a screen's actions a permission record allows. `null` (unresolved permissions) allows
 * nothing, matching the sidebar's fail-closed rule.
 */
export function allowedActions<S extends SchedulingScreen>(
  screen: S,
  permissions: PermissionsRecord | null,
): Record<keyof (typeof SCHEDULING_ACTIONS)[S], boolean> {
  const actions: Record<string, string> = SCHEDULING_ACTIONS[screen];
  return Object.fromEntries(
    Object.entries(actions).map(([action, permission]) => {
      const { feature, action: verb } = parsePermissionString(permission);
      return [action, permissions?.[feature]?.includes(verb) ?? false];
    }),
  ) as Record<keyof (typeof SCHEDULING_ACTIONS)[S], boolean>;
}
