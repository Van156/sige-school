import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import { Badge } from "@base-template/ui/components/badge";
import { UserRoundSearch } from "lucide-react";
import { useState, type ReactNode } from "react";

import { EmptyBlock } from "./empty-block";
import { FilterSelect } from "./filter-select";
import { ScreenLinkButton } from "./link-button";
import { SectionCard } from "./section-card";
import { ToneBadge } from "./tone-badge";
import { gradeOptions } from "../-lib/school-options";
import { STUDENT_STATUS_LABEL, STUDENT_STATUS_TONE } from "../-lib/school-options";
import { useGoToScreen } from "../-lib/use-go-to-screen";
import type { StudentScope } from "../-lib/use-student-scope";
import type { School } from "../-lib/use-school";
import type { AcademicStudent } from "../-mock/types";

/** Identity strip of the per-student screens: name, course, document, campus and status. */
export function StudentStrip({
  student,
  school,
  back,
  actions,
}: {
  student: AcademicStudent;
  school: School;
  /** Back navigation (see `BackButton`), rendered on the left above the card. */
  back?: ReactNode;
  actions?: ReactNode;
}) {
  const user = school.userOfStudent(student);
  const name = school.userName(student.userId) ?? "Estudiante";
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "?";
  const card = (
    <SectionCard title="Estudiante" action={actions}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-base font-semibold">{name}</span>
          <span className="text-[13px] text-muted-foreground">
            Grado:{" "}
            <strong className="font-medium text-foreground">
              {school.gradeName(student.gradeId) ?? "Sin curso"}
            </strong>
            {user ? ` | Documento: ${user.documentType} ${user.documentNumber}` : null}
            {` | Sede: ${school.campusName(student.campusId)}`}
          </span>
        </div>
        <ToneBadge tone={STUDENT_STATUS_TONE[student.status]}>
          {STUDENT_STATUS_LABEL[student.status]}
        </ToneBadge>
      </div>
    </SectionCard>
  );
  if (!back) return card;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 print:hidden">{back}</div>
      {card}
    </div>
  );
}

/**
 * Chooses the student of a per-student screen. Staff pick a course and a student (the choice goes
 * to `?student=`); a parent switches between their children; a student sees nothing to choose.
 */
export function StudentSwitcher({
  screenId,
  scope,
  school,
}: {
  screenId: string;
  scope: StudentScope;
  school: School;
}) {
  const goTo = useGoToScreen();
  const [gradeId, setGradeId] = useState("");

  if (scope.mode === "self") return null;

  if (scope.mode === "children") {
    if (scope.allowed.length < 2) return null;
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Elegir hijo/a">
        <span className="text-[13px] text-muted-foreground">Hijo/a:</span>
        {scope.allowed.map((student) => (
          <ScreenLinkButton
            key={student.id}
            screenId={screenId}
            search={{ student: String(student.id) }}
            variant={student.id === scope.selected?.id ? "default" : "outline"}
            size="sm"
          >
            {school.userName(student.userId)}
          </ScreenLinkButton>
        ))}
      </div>
    );
  }

  const courseIds = new Set(scope.allowed.map((student) => student.gradeId));
  const courses = school.grades.filter((grade) => courseIds.has(grade.id));
  const candidates = scope.allowed
    .filter((student) => !gradeId || String(student.gradeId) === gradeId)
    .toSorted((a, b) =>
      (school.userName(a.userId) ?? "").localeCompare(school.userName(b.userId) ?? "", "es"),
    );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <FilterSelect
        label="Filtrar estudiantes por grado"
        value={gradeId}
        onValueChange={setGradeId}
        options={gradeOptions(courses)}
        allLabel="Todos los grados"
      />
      <FilterSelect
        label="Estudiante"
        value={scope.selected ? String(scope.selected.id) : ""}
        onValueChange={(value) => goTo(screenId, { student: value || undefined })}
        options={candidates.map((student) => ({
          value: String(student.id),
          label: school.userName(student.userId) ?? "Estudiante",
        }))}
        allLabel="Seleccionar estudiante..."
      />
      {scope.selected ? (
        <Badge variant="outline">{school.gradeName(scope.selected.gradeId) ?? "Sin curso"}</Badge>
      ) : null}
    </div>
  );
}

/** Empty state of a per-student screen while no student is chosen (staff) or none is linked. */
export function NoStudentBlock({ scope }: { scope: StudentScope }) {
  return (
    <EmptyBlock
      icon={<UserRoundSearch />}
      title={scope.mode === "staff" ? "Selecciona un estudiante" : "Sin estudiante disponible"}
      description={
        scope.mode === "staff"
          ? "Elige un estudiante en el selector para ver su información."
          : "Tu cuenta no tiene un estudiante vinculado."
      }
    />
  );
}
