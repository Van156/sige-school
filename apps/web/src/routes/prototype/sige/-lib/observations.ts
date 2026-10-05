import { currentUserFor } from "../-mock";
import type { AcademicStudent, Observation, ObservationType } from "../-mock/types";
import type { Option } from "./user-options";
import { useRole } from "./use-role";
import type { School } from "./use-school";

/** Labels and rules of the behaviour observations (inventory 3.9), shared by OBS, STU and PAR. */

export const OBSERVATION_TYPES: readonly ObservationType[] = [
  "positiva",
  "negativa",
  "seguimiento",
  "convivencia",
];

export const OBSERVATION_LABEL: Record<ObservationType, string> = {
  positiva: "Positiva",
  negativa: "Negativa",
  seguimiento: "Seguimiento",
  convivencia: "Convivencia",
};

export const OBSERVATION_EMOJI: Record<ObservationType, string> = {
  positiva: "👍",
  negativa: "⚠️",
  seguimiento: "📋",
  convivencia: "🤝",
};

export const OBSERVATION_HINT: Record<ObservationType, string> = {
  positiva: "Reconocimiento de buen comportamiento o logro",
  negativa: "Comportamiento inadecuado o falta grave",
  seguimiento: "Monitoreo de progreso o situación",
  convivencia: "Aspectos relacionados con la convivencia escolar",
};

export const OBSERVATION_TYPE_OPTIONS: readonly Option[] = OBSERVATION_TYPES.map((type) => ({
  value: type,
  label: `${OBSERVATION_EMOJI[type]} ${OBSERVATION_LABEL[type]}`,
}));

export const OBSERVATION_CATEGORIES: readonly string[] = [
  "Disciplina",
  "Rendimiento",
  "Valores",
  "Convivencia",
  "Responsabilidad",
  "Participación",
  "Otro",
];

export const OBSERVATION_CATEGORY_OPTIONS: readonly Option[] = OBSERVATION_CATEGORIES.map(
  (category) => ({ value: category, label: category }),
);

export function toObservationType(value: string): ObservationType {
  return OBSERVATION_TYPES.find((type) => type === value) ?? "seguimiento";
}

/** Negative and "convivencia" observations must be reported to the guardians. */
export function requiresNotification(type: ObservationType): boolean {
  return type === "negativa" || type === "convivencia";
}

export function isPending(observation: Pick<Observation, "type" | "notified">): boolean {
  return requiresNotification(observation.type) && !observation.notified;
}

export interface ObservationCounts {
  total: number;
  positiva: number;
  negativa: number;
  seguimiento: number;
  convivencia: number;
  notified: number;
  pending: number;
}

export function countObservations(rows: readonly Observation[]): ObservationCounts {
  const of = (type: ObservationType) => rows.filter((row) => row.type === type).length;
  return {
    total: rows.length,
    positiva: of("positiva"),
    negativa: of("negativa"),
    seguimiento: of("seguimiento"),
    convivencia: of("convivencia"),
    notified: rows.filter((row) => row.notified).length,
    pending: rows.filter(isPending).length,
  };
}

/**
 * Who may see, edit and delete observations: teachers only work with the courses they teach and
 * cannot delete; editing is open to the author and to the grade-editor roles (root/admin/teacher).
 */
export function useObservationAccess(school: School) {
  const role = useRole();
  const user = currentUserFor(role);
  const teacherId = currentUserFor("teacher").id;
  const taughtGrades = new Set(
    school.subjectGrades.filter((item) => item.teacherId === teacherId).map((item) => item.gradeId),
  );
  const inScope = (student: AcademicStudent | undefined) =>
    student !== undefined &&
    (role !== "teacher" || (student.gradeId !== undefined && taughtGrades.has(student.gradeId)));

  return {
    role,
    userId: user.id,
    canSeeStudent: (studentId: number) => inScope(school.studentById.get(studentId)),
    canEdit: (observation: Observation) =>
      role === "root" || role === "admin" || role === "teacher" || observation.authorId === user.id,
    canDelete: role === "root" || role === "admin" || role === "coordinator",
  };
}

export type ObservationAccess = ReturnType<typeof useObservationAccess>;
