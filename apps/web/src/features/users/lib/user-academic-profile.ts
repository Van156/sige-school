import type { UserDetail } from "../types";

/** The USR-03 "Acciones Rápidas" link to a student's academic profile (sige/03 §5.3). */
export type AcademicProfileAction =
  | { kind: "view"; studentId: string }
  | { kind: "complete"; personId: string };

/**
 * "Ver Perfil Académico" (→ STU-02, needs `student:read`) when the student has a profile, else
 * "Completar Perfil Académico" (→ STU-03 complete, needs `student:create`). Non-students, and
 * callers without the target page's permission, get no link (`null`).
 */
export function academicProfileAction(
  user: Pick<UserDetail, "role" | "personId" | "studentId">,
  access: { canViewStudent: boolean; canCompleteProfile: boolean },
): AcademicProfileAction | null {
  if (user.role !== "student") {
    return null;
  }
  if (user.studentId !== null) {
    return access.canViewStudent ? { kind: "view", studentId: user.studentId } : null;
  }
  return access.canCompleteProfile ? { kind: "complete", personId: user.personId } : null;
}

export const ACADEMIC_PROFILE_LABELS: Record<AcademicProfileAction["kind"], string> = {
  view: "Ver Perfil Académico",
  complete: "Completar Perfil Académico",
};
