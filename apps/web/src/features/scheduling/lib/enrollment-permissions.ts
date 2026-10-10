/**
 * The permission behind each SCH-01/02 action (sige/04 §3.3; SCH-R1: only owner, admin and
 * coordinator hold the `enrollment` grants). A link names the gate of the route it opens, a button
 * the procedure it calls. UX only: the procedures re-check.
 */
export const ENROLLMENT_ACTIONS = {
  /** SCH-01 itself (`enrollment.list`, `enrollment.stats`) and SCH-02 edit's read (`enrollment.get`). */
  list: "enrollment:read",
  /** "Ver Estudiantes" → STU-01 (`student.list`). */
  viewStudents: "student:read",
  /** "Nueva Matrícula", "Crear Matrícula" and SCH-02 create (`enrollment.candidates`, `createBulk`). */
  create: "enrollment:create",
  /** Row edit and SCH-02 edit (`enrollment.update`). */
  edit: "enrollment:update",
  /** Row delete (`enrollment.delete`). */
  delete: "enrollment:delete",
} as const satisfies Record<string, `${string}:${string}`>;
