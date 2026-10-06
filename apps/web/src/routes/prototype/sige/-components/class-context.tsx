import { BookOpenCheck, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyBlock } from "./empty-block";
import { ScreenLinkButton } from "./link-button";
import { NotFoundBlock } from "./not-found-block";
import { useAccessibleSubjectGrades, type Grading } from "../-lib/use-grading";
import type { School } from "../-lib/use-school";
import { useIntParam } from "../-lib/use-search-params";
import type { SubjectGradeRecord } from "../-mock";
import type { AcademicPeriod, AcademicStudent, Grade } from "../-mock/types";

/** Everything a class-level screen (one subject in one course, optionally one period) needs. */
export interface ClassInfo {
  subjectGrade: SubjectGradeRecord;
  grade: Grade;
  subjectName: string;
  teacherName: string | undefined;
  /** Period of `?period=` (default: the active one); `undefined` for period-less screens. */
  period: AcademicPeriod | undefined;
  /** Active students of the course, ordered by last name. */
  students: AcademicStudent[];
  userId: number;
}

/**
 * Resolves `?sg=` (and `?period=`) into a `ClassInfo` and renders the standard guard states:
 * nothing selected, unknown class, or a teacher opening a class that is not theirs.
 */
export function ClassContext({
  school,
  grading,
  selectScreenId,
  withPeriod = true,
  permissionMessage = "No tienes permiso para ver esta asignatura.",
  children,
}: {
  school: School;
  grading: Grading;
  /** Screen that lets the user pick a class (GRD-01 or ATT-01). */
  selectScreenId: string;
  withPeriod?: boolean;
  permissionMessage?: string;
  children: (info: ClassInfo) => ReactNode;
}) {
  const subjectGradeId = useIntParam("sg");
  const periodId = useIntParam("period");
  const access = useAccessibleSubjectGrades(school);

  if (subjectGradeId === undefined) {
    return (
      <EmptyBlock
        icon={<BookOpenCheck />}
        title="Selecciona una asignatura"
        description="Elige un grado y una asignatura para continuar."
        action={<ScreenLinkButton screenId={selectScreenId}>Ir a la selección</ScreenLinkButton>}
      />
    );
  }

  const subjectGrade = school.subjectGrades.find((item) => item.id === subjectGradeId);
  const grade = subjectGrade ? school.gradeById.get(subjectGrade.gradeId) : undefined;
  if (!subjectGrade || !grade) {
    return <NotFoundBlock entity="Asignatura" feminine backScreenId={selectScreenId} />;
  }
  if (!access.canAccess(subjectGrade.id)) {
    return (
      <EmptyBlock
        icon={<ShieldOff />}
        title="Acceso prohibido"
        description={permissionMessage}
        action={
          <ScreenLinkButton screenId={selectScreenId}>Volver a la selección</ScreenLinkButton>
        }
      />
    );
  }

  const period = withPeriod
    ? (grading.periods.find((item) => item.id === periodId) ?? grading.activePeriod)
    : undefined;
  if (withPeriod && !period) {
    return (
      <EmptyBlock
        title="No hay periodos académicos configurados"
        description="Configure los periodos primero."
      />
    );
  }

  const students = school.students
    .filter((student) => student.gradeId === grade.id && student.status === "activo")
    .toSorted((a, b) => {
      const userA = school.userOfStudent(a);
      const userB = school.userOfStudent(b);
      return (
        (userA?.lastName ?? "").localeCompare(userB?.lastName ?? "", "es") ||
        (userA?.firstName ?? "").localeCompare(userB?.firstName ?? "", "es")
      );
    });

  return children({
    subjectGrade,
    grade,
    subjectName: school.subjectName(subjectGrade.subjectId),
    teacherName: school.userName(subjectGrade.teacherId),
    period,
    students,
    userId: access.userId,
  });
}
