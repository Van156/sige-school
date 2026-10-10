/**
 * The permission behind each STU-01 action (sige/05 §3.1, §5.1). Pages read `useCan` with these
 * keys; UX only, the procedures re-check.
 */
export const STUDENT_PERMISSIONS = {
  /** The page itself (`student.list`, `student.filterOptions`). */
  list: "student:read",
  /** "Perfiles Académicos Incompletos" (`student.listIncomplete`). */
  create: "student:create",
  /** Row "Eliminar" (`student.delete`). */
  delete: "student:delete",
  /** Incomplete-profile row "Editar usuario" → USR-03. */
  editUser: "user:update",
} as const satisfies Record<string, `${string}:${string}`>;
