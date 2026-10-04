import { CalendarClock, Wand2 } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyBlock } from "../../-components/empty-block";
import { FilterSelect } from "../../-components/filter-select";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { WeeklySchedule } from "../../-components/weekly-schedule";
import { useCan } from "../../-lib/permissions";
import { gradeOptions } from "../../-lib/school-options";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useRole } from "../../-lib/use-role";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import { currentUserFor, mockAction, scheduleStore } from "../../-mock";
import type { Institution, Role } from "../../-mock/types";
import type { ScheduleRow } from "../../-mock";

/**
 * SCH-11: weekly timetable. Managers pick a course (`?grade=`) and can remove classes; a teacher
 * sees their own classes and a student the schedule of their course.
 */
export function SchedulesScreen() {
  const canGenerate = useCan("SCH-12");
  const role = useRole();

  return (
    <ScopedPage
      screenId="SCH-11"
      title="Horarios de Clases"
      description={
        role === "teacher"
          ? "Tus clases de la semana"
          : role === "student"
            ? "Horario semanal de tu grado"
            : "Horario semanal por grado"
      }
      target="Horarios"
      banner={canGenerate}
      actions={
        canGenerate ? (
          <ScreenLinkButton screenId="SCH-12" variant="default">
            <Wand2 data-icon="inline-start" />
            Generar Horario Automático
          </ScreenLinkButton>
        ) : undefined
      }
    >
      {(institution) => <SchedulesView institution={institution} role={role} />}
    </ScopedPage>
  );
}

function SchedulesView({ institution, role }: { institution: Institution; role: Role }) {
  const school = useSchool(institution.id);

  if (role === "teacher") {
    const teacher = currentUserFor("teacher");
    return (
      <ScheduleCard
        title={`Horario de ${school.userName(teacher.id) ?? "profesor"}`}
        rows={school.teacherScheduleRows(teacher.id)}
        canManage={false}
      />
    );
  }
  if (role === "student") {
    const self = currentUserFor("student");
    const student = school.students.find((entry) => entry.userId === self.id);
    const grade =
      student?.gradeId === undefined ? undefined : school.gradeById.get(student.gradeId);
    return grade ? (
      <ScheduleCard
        title={`Horario del grado ${grade.name}`}
        rows={school.gradeScheduleRows(grade)}
        canManage={false}
      />
    ) : (
      <EmptyBlock
        icon={<CalendarClock />}
        title="Sin curso asignado"
        description="No estás asignado a ningún curso. Contacta con coordinación académica."
      />
    );
  }
  return <ManagerSchedule school={school} />;
}

function ManagerSchedule({ school }: { school: School }) {
  const goTo = useGoToScreen();
  const gradeParam = useIntParam("grade");
  const grade = school.grades.find((entry) => entry.id === gradeParam) ?? school.grades[0];

  if (!grade) {
    return (
      <EmptyBlock
        icon={<CalendarClock />}
        title="No hay grados registrados"
        description="Crea grados y asígnales materias para generar horarios."
      />
    );
  }

  return (
    <ScheduleCard
      title={`Horario del grado ${grade.name}`}
      rows={school.gradeScheduleRows(grade)}
      canManage
      filter={
        <FilterSelect
          label="Filtrar por grado"
          value={String(grade.id)}
          onValueChange={(value) => goTo("SCH-11", { grade: value })}
          options={gradeOptions(school.grades)}
        />
      }
    />
  );
}

function ScheduleCard({
  title,
  rows,
  canManage,
  filter,
}: {
  title: string;
  rows: readonly ScheduleRow[];
  canManage: boolean;
  filter?: ReactNode;
}) {
  const hasClasses = rows.some((row) => row.cells.some((cell) => cell !== null));

  return (
    <SectionCard title={title} action={filter}>
      {hasClasses ? (
        <WeeklySchedule
          rows={rows}
          onRemove={
            canManage
              ? (scheduleId) => {
                  scheduleStore.remove(scheduleId);
                  mockAction("Clase eliminada del horario");
                }
              : undefined
          }
        />
      ) : (
        <EmptyBlock
          icon={<CalendarClock />}
          title="No hay horarios generados"
          description="Genere los horarios automáticamente o asigne manualmente."
          action={
            canManage ? (
              <ScreenLinkButton screenId="SCH-12" variant="default">
                Generar Horario Automático
              </ScreenLinkButton>
            ) : undefined
          }
        />
      )}
    </SectionCard>
  );
}
