/**
 * The permission behind each STU-01…05 action (sige/05 §3.1, §5.1–§5.5). Pages read `useCan`
 * with these keys; UX only, the procedures re-check.
 */
export const STUDENT_PERMISSIONS = {
  /** The page itself (`student.list`, `student.filterOptions`). */
  list: "student:read",
  /**
   * "Nuevo Estudiante", "Crear Estudiante", "Completar" and "Perfiles Académicos Incompletos"
   * (`student.create`, `student.complete`, `student.listIncomplete`).
   */
  create: "student:create",
  /** Row and profile "Editar" (`student.update`). */
  update: "student:update",
  /** Row "Eliminar" (`student.delete`). */
  delete: "student:delete",
  /** STU-02 "Asignar Acudientes" / "Gestionar" and STU-04 (`guardian.*`). */
  guardians: "student:guardians",
  /** STU-01 "Cargar Excel" and STU-05 (`student.import*`). */
  import: "student:import",
  /** STU-04 "Crear acudiente primero" → USR-02 (`user:create` is admin-only, G-STU-4). */
  createUser: "user:create",
  /** Incomplete-profile row "Editar usuario" → USR-03. */
  editUser: "user:update",
  /** STU-03 complete "Cancelar" returns to USR-01 only for callers who can read it. */
  listUsers: "user:read",
  /** STU-02 "Ver en pantalla completa" → the managers' course view of SCH-11. */
  courseSchedule: "course:read",
} as const satisfies Record<string, `${string}:${string}`>;
