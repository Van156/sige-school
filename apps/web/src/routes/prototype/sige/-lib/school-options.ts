import type {
  AssignmentStatus,
  ClassroomType,
  EnrollmentStatus,
  Shift,
  StudentStatus,
} from "../-mock/types";
import type { Option } from "./user-options";
import type { BadgeTone } from "./roles";

/** Labels, tones and select options shared by the scheduling (SCH) and student (STU) screens. */

export const SHIFTS: readonly Shift[] = ["Mañana", "Tarde", "Nocturna", "Única", "Sabatina"];
export const SHIFT_OPTIONS: readonly Option[] = SHIFTS.map((shift) => ({
  value: shift,
  label: shift,
}));

export function toShift(value: string): Shift {
  return SHIFTS.find((shift) => shift === value) ?? "Mañana";
}

export const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  activa: "Activa",
  cancelada: "Cancelada",
  retirada: "Retirada",
};

export const ENROLLMENT_TONE: Record<EnrollmentStatus, BadgeTone> = {
  activa: "success",
  cancelada: "secondary",
  retirada: "destructive",
};

export const ENROLLMENT_OPTIONS: readonly Option[] = (
  Object.keys(ENROLLMENT_LABEL) as EnrollmentStatus[]
).map((status) => ({ value: status, label: ENROLLMENT_LABEL[status] }));

export function toEnrollmentStatus(value: string): EnrollmentStatus {
  return value === "cancelada" || value === "retirada" ? value : "activa";
}

export const ASSIGNMENT_LABEL: Record<AssignmentStatus, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  temporal: "Temporal",
};

export const ASSIGNMENT_TONE: Record<AssignmentStatus, BadgeTone> = {
  activo: "success",
  inactivo: "secondary",
  temporal: "warning",
};

export const ASSIGNMENT_OPTIONS: readonly Option[] = (
  Object.keys(ASSIGNMENT_LABEL) as AssignmentStatus[]
).map((status) => ({ value: status, label: ASSIGNMENT_LABEL[status] }));

export function toAssignmentStatus(value: string): AssignmentStatus {
  return value === "inactivo" || value === "temporal" ? value : "activo";
}

export const CLASSROOM_TYPE_LABEL: Record<ClassroomType, string> = {
  aula: "Aula",
  laboratorio: "Laboratorio",
  auditorio: "Auditorio",
  cancha: "Cancha",
};

export const CLASSROOM_TYPE_TONE: Record<ClassroomType, BadgeTone> = {
  aula: "info",
  laboratorio: "warning",
  auditorio: "default",
  cancha: "success",
};

export const CLASSROOM_TYPE_OPTIONS: readonly Option[] = (
  Object.keys(CLASSROOM_TYPE_LABEL) as ClassroomType[]
).map((type) => ({ value: type, label: CLASSROOM_TYPE_LABEL[type] }));

export function toClassroomType(value: string): ClassroomType {
  return value === "laboratorio" || value === "auditorio" || value === "cancha" ? value : "aula";
}

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  activo: "Activo",
  retirado: "Retirado",
  graduado: "Graduado",
};

export const STUDENT_STATUS_TONE: Record<StudentStatus, BadgeTone> = {
  activo: "success",
  retirado: "destructive",
  graduado: "info",
};

export const STUDENT_STATUS_OPTIONS: readonly Option[] = (
  Object.keys(STUDENT_STATUS_LABEL) as StudentStatus[]
).map((status) => ({ value: status, label: STUDENT_STATUS_LABEL[status] }));

export function toStudentStatus(value: string): StudentStatus {
  return value === "retirado" || value === "graduado" ? value : "activo";
}

/** Document types a student may hold (inventory STU-03). */
export const STUDENT_DOC_OPTIONS: readonly Option[] = [
  { value: "TI", label: "TI - Tarjeta de Identidad" },
  { value: "RC", label: "RC - Registro Civil" },
  { value: "CC", label: "CC - Cédula de Ciudadanía" },
];

export const RELATIONSHIP_OPTIONS: readonly Option[] = [
  "Acudiente",
  "Padre",
  "Madre",
  "Tío/a",
  "Abuelo/a",
  "Hermano/a",
  "Otro",
].map((relationship) => ({ value: relationship, label: relationship }));

export function toStratum(value: string): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const parsed = Number(value);
  return parsed === 1 ||
    parsed === 2 ||
    parsed === 3 ||
    parsed === 4 ||
    parsed === 5 ||
    parsed === 6
    ? parsed
    : undefined;
}

/* ------------------------------ Entity option lists ------------------------------ */

export function gradeOptions(grades: readonly { id: number; name: string }[]): Option[] {
  return grades.map((grade) => ({ value: String(grade.id), label: grade.name }));
}

export function subjectOptions(subjects: readonly { id: number; name: string }[]): Option[] {
  return subjects.map((subject) => ({ value: String(subject.id), label: subject.name }));
}

export function campusOptions(campuses: readonly { id: number; name: string }[]): Option[] {
  return campuses.map((campus) => ({ value: String(campus.id), label: campus.name }));
}

export function teacherOptions(
  teachers: readonly { id: number; firstName: string; lastName: string }[],
): Option[] {
  return teachers.map((teacher) => ({
    value: String(teacher.id),
    label: `${teacher.firstName} ${teacher.lastName}`,
  }));
}
