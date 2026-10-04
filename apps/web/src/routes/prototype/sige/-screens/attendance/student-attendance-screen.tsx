import { CalendarCheck, CircleCheck, CircleX, FileDown, ListChecks } from "lucide-react";

import { MonthlyAttendanceChart } from "../../-components/attendance-charts";
import { Callout } from "../../-components/callout";
import { DonutChart } from "../../-components/charts";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { AttendanceStatusBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { NoStudentBlock, StudentStrip, StudentSwitcher } from "../../-components/student-strip";
import { Button } from "@base-template/ui/components/button";
import { monthLabel, monthlyTally, shareOf, tally } from "../../-lib/class-stats";
import { formatDate, formatPercent } from "../../-lib/format";
import { useAccessibleSubjectGrades, useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useStudentScope, type StudentScope } from "../../-lib/use-student-scope";
import { absenceRate, mockInfo } from "../../-mock";
import type { AcademicStudent, Attendance, Institution } from "../../-mock/types";

/** ATT-02: attendance history of one student (`?student=`; a student sees their own). */
export function StudentAttendanceScreen() {
  return (
    <ScopedPage
      screenId="ATT-02"
      title="Historial de Asistencia"
      description="Asistencia por asignatura, mes y estado"
      target="Asistencia"
      banner={false}
    >
      {(institution) => <StudentAttendanceView institution={institution} />}
    </ScopedPage>
  );
}

function StudentAttendanceView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const scope = useStudentScope(school);
  const access = useAccessibleSubjectGrades(school);

  return (
    <>
      <StudentSwitcher screenId="ATT-02" scope={scope} school={school} />
      {scope.selected ? (
        <History
          student={scope.selected}
          school={school}
          grading={grading}
          scope={scope}
          canSee={access.canAccess}
        />
      ) : (
        <NoStudentBlock scope={scope} />
      )}
    </>
  );
}

function History({
  student,
  school,
  grading,
  scope,
  canSee,
}: {
  student: AcademicStudent;
  school: School;
  grading: Grading;
  scope: StudentScope;
  /** Teachers only see the subjects they teach. */
  canSee: (subjectGradeId: number) => boolean;
}) {
  const rows = grading.attendance
    .filter((row) => row.studentId === student.id && canSee(row.subjectGradeId))
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const totals = tally(rows);
  const rate = absenceRate(rows);
  const months = monthlyTally(rows);
  const staff = scope.mode === "staff";

  const columns: TableColumn<Attendance>[] = [
    {
      key: "date",
      header: "Fecha",
      sortValue: (row) => row.date,
      cell: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
    },
    {
      key: "subject",
      header: "Asignatura",
      sortValue: (row) => subjectOf(row.subjectGradeId),
      cell: (row) => subjectOf(row.subjectGradeId),
    },
    {
      key: "status",
      header: "Estado",
      sortValue: (row) => row.status,
      cell: (row) => <AttendanceStatusBadge status={row.status} />,
    },
    {
      key: "observation",
      header: "Observación",
      cell: (row) => row.observation ?? <span className="text-muted-foreground">-</span>,
    },
    {
      key: "by",
      header: "Registrado por",
      sortValue: (row) => school.userName(row.recordedBy) ?? "",
      cell: (row) => school.userName(row.recordedBy) ?? `Usuario #${row.recordedBy}`,
    },
  ];

  function subjectOf(subjectGradeId: number): string {
    const item = school.subjectGradeById.get(subjectGradeId);
    return item ? school.subjectName(item.subjectId) : "N/A";
  }

  return (
    <>
      <StudentStrip
        student={student}
        school={school}
        actions={
          staff ? (
            <div className="flex flex-wrap gap-2">
              <BackButton
                screenId="STU-02"
                search={{ id: String(student.id) }}
                label="Volver al Perfil"
              />
              <ScreenLinkButton screenId="ATT-01" variant="default">
                <CalendarCheck data-icon="inline-start" />
                Tomar Asistencia
              </ScreenLinkButton>
            </div>
          ) : undefined
        }
      />

      {rate > 20 ? (
        <Callout tone="destructive" title="¡Alerta de Inasistencia Crítica!">
          Este estudiante tiene una tasa de inasistencia del{" "}
          <strong>{formatPercent(rate, 1)}</strong>, que supera el umbral crítico del 20%. Se
          recomienda notificar a coordinación y al acudiente.
        </Callout>
      ) : rate > 10 ? (
        <Callout tone="warning" title="Atención: Tendencia de Inasistencia">
          Este estudiante tiene una tasa de inasistencia del{" "}
          <strong>{formatPercent(rate, 1)}</strong>. Monitorear de cerca para evitar ausencias
          críticas.
        </Callout>
      ) : null}

      {rows.length === 0 ? (
        <EmptyBlock
          icon={<ListChecks />}
          title="Sin registros de asistencia"
          description="No hay registros de asistencia para este estudiante."
        />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Total Registros" value={totals.total} icon={ListChecks} />
            <StatTile
              label="Presentes"
              value={totals.present}
              icon={CircleCheck}
              tone="success"
              hint={formatPercent(shareOf(totals.present, totals.total), 1)}
            />
            <StatTile
              label="Ausentes"
              value={totals.absent}
              icon={CircleX}
              tone="destructive"
              hint={formatPercent(shareOf(totals.absent, totals.total), 1)}
            />
            <StatTile
              label="Justificados"
              value={totals.justified}
              icon={CalendarCheck}
              tone="warning"
              hint={formatPercent(shareOf(totals.justified, totals.total), 1)}
            />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Distribución General">
              <DonutChart
                ariaLabel="Distribución de asistencia: presentes, ausentes y justificados"
                data={[
                  { label: "Presentes", value: totals.present, color: "var(--success)" },
                  { label: "Ausentes", value: totals.absent, color: "var(--destructive)" },
                  { label: "Justificados", value: totals.justified, color: "var(--warning)" },
                ]}
              />
            </SectionCard>
            <SectionCard title="Tendencia Mensual">
              <MonthlyAttendanceChart
                months={months}
                variant="bar"
                ariaLabel="Asistencia mensual por estado"
              />
            </SectionCard>
          </div>

          <SectionCard title="Desglose Mensual">
            <ul className="flex flex-col divide-y text-[13px]">
              {months.toReversed().map((entry) => (
                <li
                  key={entry.month}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
                >
                  <span>
                    <strong className="font-medium">{monthLabel(entry.month)}</strong>{" "}
                    <span className="text-muted-foreground">({entry.total} registros)</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 tabular-nums">
                    <span className="text-success">{entry.present} presentes</span>
                    <span className="text-destructive">{entry.absent} ausentes</span>
                    <span>{entry.justified} justificados</span>
                    <strong className="font-medium">
                      {formatPercent(shareOf(entry.total - entry.present, entry.total), 1)}{" "}
                      ausencias
                    </strong>
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Historial de Asistencia"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => mockInfo("Exportar CSV", "La descarga no existe en el prototipo.")}
              >
                <FileDown data-icon="inline-start" />
                Exportar CSV
              </Button>
            }
          >
            <SimpleTable columns={columns} rows={rows} getRowId={(row) => row.id} pageSize={15} />
          </SectionCard>
        </>
      )}
    </>
  );
}
