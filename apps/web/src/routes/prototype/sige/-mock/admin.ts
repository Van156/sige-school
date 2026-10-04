import { useSyncExternalStore } from "react";

import { gradeRecords, finalGrades } from "./academics";
import {
  INSTITUTION_ID,
  campuses,
  criteria,
  gradeLevels,
  grades,
  institutions,
  periods,
  stubInstitutionSummaries,
  subjects,
} from "./base";
import { users } from "./people";
import {
  blockStore,
  classroomStore,
  parentLinkStore,
  studentStore,
  subjectGradeStore,
} from "./school";
import { institutionCounts } from "./selectors";
import { REFERENCE_DATE } from "./dates";
import { createMockCollection } from "./store";
import type { InstitutionSummary, Role, User } from "./types";

/**
 * Editable copies of the structure and user collections (T2). The static arrays stay untouched for
 * the read-only dashboards; the institution and user screens read and write these stores, so edits
 * live until the page reloads.
 */

export const institutionStore = createMockCollection(institutions);
export const campusStore = createMockCollection(campuses);
export const gradeLevelStore = createMockCollection(gradeLevels);
export const gradeStore = createMockCollection(grades);
export const subjectStore = createMockCollection(subjects);
export const periodStore = createMockCollection(periods);
export const criteriaStore = createMockCollection(criteria);
/**
 * Student account created in USR-02 whose academic profile is still missing: the seed of the
 * "Perfiles Académicos Incompletos" table of STU-01 (kept out of the read-only dashboard counts).
 */
const pendingStudentUser: User = {
  id: 1000,
  username: "bmendoza4821",
  email: "bmendoza4821@estudiantes.colegiosanjose.edu.co",
  firstName: "Brayan Stiven",
  lastName: "Mendoza Ríos",
  documentType: "TI",
  documentNumber: "1098764821",
  birthDate: "2013-03-18",
  gender: "M",
  phone: "3104567821",
  role: "student",
  institutionId: INSTITUTION_ID,
  isActive: true,
  mustChangePassword: true,
  createdAt: REFERENCE_DATE,
};

export const userStore = createMockCollection<User>([...users, pendingStudentUser]);

/* --------------------------- Root institution context --------------------------- */

let activeInstitutionId: number | null = null;
const contextListeners = new Set<() => void>();

/** Root's "active institution" (legacy `active_institution_id` session value). */
export function setActiveInstitution(id: number | null) {
  activeInstitutionId = id;
  contextListeners.forEach((listener) => listener());
}

export function useActiveInstitutionId(): number | null {
  return useSyncExternalStore(
    (listener) => {
      contextListeners.add(listener);
      return () => contextListeners.delete(listener);
    },
    () => activeInstitutionId,
    () => activeInstitutionId,
  );
}

/* --------------------------------- Summaries --------------------------------- */

/** Live counts for San José, static counts for the stub institutions, zeros for new ones. */
export function summarizeInstitution(
  id: number,
  campusList: readonly { institutionId: number }[],
  userList: readonly User[],
): InstitutionSummary {
  const stub = stubInstitutionSummaries.find((summary) => summary.institutionId === id);
  if (stub) return stub;
  const own = userList.filter((user) => user.institutionId === id);
  const count = (role: Role) => own.filter((user) => user.role === role).length;
  return {
    institutionId: id,
    admins: count("admin"),
    campuses: campusList.filter((campus) => campus.institutionId === id).length,
    teachers: count("teacher"),
    students: id === INSTITUTION_ID ? institutionCounts().students : count("student"),
    users: own.length,
  };
}

/* ------------------------------ Guarded deletions ------------------------------ */

export type DeleteResult = { ok: true } | { ok: false; reason: string };

const OK: DeleteResult = { ok: true };
const blocked = (reason: string): DeleteResult => ({ ok: false, reason });

export function deleteInstitution(id: number): DeleteResult {
  const stub = stubInstitutionSummaries.find((summary) => summary.institutionId === id);
  const hasCampuses = campusStore.getSnapshot().some((campus) => campus.institutionId === id);
  const hasUsers = userStore.getSnapshot().some((user) => user.institutionId === id);
  if (hasCampuses || hasUsers || (stub && (stub.campuses > 0 || stub.users > 0))) {
    return blocked("La institución tiene sedes o usuarios asociados.");
  }
  institutionStore.remove(id);
  return OK;
}

export function deleteCampus(id: number): DeleteResult {
  const hasDependents =
    gradeLevelStore.getSnapshot().some((level) => level.campusId === id) ||
    gradeStore.getSnapshot().some((grade) => grade.campusId === id);
  if (hasDependents) return blocked("La sede tiene niveles o grados asociados.");
  const hasFacilities =
    classroomStore.getSnapshot().some((room) => room.campusId === id) ||
    blockStore.getSnapshot().some((block) => block.campusId === id);
  if (hasFacilities) return blocked("La sede tiene salones o bloques horarios asociados.");
  campusStore.remove(id);
  return OK;
}

export function deleteGradeLevel(id: number): DeleteResult {
  if (gradeStore.getSnapshot().some((grade) => grade.levelId === id)) {
    return blocked("El nivel tiene cursos asociados.");
  }
  gradeLevelStore.remove(id);
  return OK;
}

export function deleteGrade(id: number): DeleteResult {
  if (studentStore.getSnapshot().some((student) => student.gradeId === id)) {
    return blocked("El grado tiene estudiantes asociados.");
  }
  if (subjectGradeStore.getSnapshot().some((item) => item.gradeId === id)) {
    return blocked("El grado tiene asignaturas asignadas.");
  }
  gradeStore.remove(id);
  return OK;
}

export function deleteSubject(id: number): DeleteResult {
  if (subjectGradeStore.getSnapshot().some((item) => item.subjectId === id)) {
    return blocked("La asignatura está asignada a uno o más grados.");
  }
  subjectStore.remove(id);
  return OK;
}

export function deletePeriod(id: number): DeleteResult {
  if (finalGrades.some((final) => final.periodId === id)) {
    return blocked("El periodo tiene notas registradas.");
  }
  periodStore.remove(id);
  return OK;
}

export function deleteCriterion(id: number): DeleteResult {
  if (gradeRecords.some((record) => record.criterionId === id)) {
    return blocked("El criterio tiene notas registradas.");
  }
  criteriaStore.remove(id);
  return OK;
}

export function deleteUser(id: number): DeleteResult {
  const user = userStore.getSnapshot().find((entry) => entry.id === id);
  if (!user) return OK;
  if (user.role === "teacher") {
    const teaches =
      subjectGradeStore.getSnapshot().some((item) => item.teacherId === id) ||
      gradeStore.getSnapshot().some((grade) => grade.directorId === id);
    if (teaches) return blocked("El profesor tiene asignaturas o grupos a cargo.");
  }
  if (
    user.role === "student" &&
    studentStore.getSnapshot().some((student) => student.userId === id)
  ) {
    return blocked("El estudiante tiene un perfil académico con notas y matrículas.");
  }
  if (
    user.role === "parent" &&
    parentLinkStore.getSnapshot().some((link) => link.parentId === id)
  ) {
    return blocked("El acudiente tiene estudiantes vinculados.");
  }
  userStore.remove(id);
  return OK;
}
