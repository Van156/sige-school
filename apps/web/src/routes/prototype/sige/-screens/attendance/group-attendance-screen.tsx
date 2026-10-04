import { Button } from "@base-template/ui/components/button";
import { Badge } from "@base-template/ui/components/badge";
import { CalendarCheck, CircleCheck, CircleX, FileDown, ListChecks } from "lucide-react";

import { MonthlyAttendanceChart } from "../../-components/attendance-charts";
import { ClassContext, type ClassInfo } from "../../-components/class-context";
import { EmptyBlock } from "../../-components/empty-block";
import { EntityList } from "../../-components/entity-list";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { AbsenceBandBadge, RateBar } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import type { TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { StudentLink } from "../../-components/student-link";
import {
  attendanceByStudent,
  monthlyTally,
  shareOf,
  tally,
  type StudentAttendanceRow,
} from "../../-lib/class-stats";
import { formatPercent } from "../../-lib/format";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import { mockInfo } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** ATT-03: attendance summary of one subject-grade (`?sg=`). */
export function GroupAttendanceScreen() {
  const subjectGrade = useIntParam("sg");
  const search = { sg: subjectGrade === undefined ? undefined : String(subjectGrade) };
  return (
    <ScopedPage
      screenId="ATT-03"
      title="Resumen de Asistencia"
      description="Asistencia acumulada del grupo"
      target="Asistencia"
      banner={false}
      actions={
        <>
          <ScreenLinkButton screenId="ATT-01" search={search} variant="default">
            <CalendarCheck data-icon="inline-start" />
            Tomar Asistencia
          </ScreenLinkButton>
          <ScreenLinkButton screenId="ATT-04" search={search}>
            Reporte por Rango
          </ScreenLinkButton>
          <ScreenLinkButton screenId="STU-01">Ver Estudiantes</ScreenLinkButton>
        </>
      }
    >
      {(institution) => <GroupView institution={institution} />}
    </ScopedPage>
  );
}

function GroupView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  return (
    <ClassContext
      school={school}
      grading={grading}
      selectScreenId="ATT-01"
      withPeriod={false}
      permissionMessage="No tienes permiso para ver esta asignatura."
    >
      {(info) => <GroupSummary info={info} school={school} grading={grading} />}
    </ClassContext>
  );
}

function GroupSummary({
  info,
  school,
  grading,
}: {
  info: ClassInfo;
  school: School;
  grading: Grading;
}) {
  const rows = grading.attendance.filter((row) => row.subjectGradeId === info.subjectGrade.id);
  const perStudent = attendanceByStudent(
    info.students.map((student) => student.id),
    rows,
  );
  const totals = tally(rows);
  const atRisk = perStudent.filter((entry) => entry.absentRate > 20 && entry.total > 0);
  const nameOf = (studentId: number) =>
    school.userName(school.studentById.get(studentId)?.userId ?? -1) ?? "Estudiante";

  if (rows.length === 0) {
    return (
      <EmptyBlock
        icon={<ListChecks />}
        title="Sin registros de asistencia"
        description={`Aún no se ha tomado asistencia en ${info.subjectName} - ${info.grade.name}.`}
        action={
          <ScreenLinkButton
            screenId="ATT-01"
            search={{ sg: String(info.subjectGrade.id) }}
            variant="default"
          >
            Tomar Asistencia
          </ScreenLinkButton>
        }
      />
    );
  }

  const columns: TableColumn<StudentAttendanceRow>[] = [
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => nameOf(row.studentId),
      cell: (row) => (
        <StudentLink screenId="ATT-02" studentId={row.studentId}>
          {nameOf(row.studentId)}
        </StudentLink>
      ),
    },
    {
      key: "present",
      header: "Presentes",
      align: "right",
      sortValue: (row) => row.present,
      cell: (row) => <span className="tabular-nums">{row.present}</span>,
    },
    {
      key: "absent",
      header: "Ausentes",
      align: "right",
      sortValue: (row) => row.absent,
      cell: (row) => <span className="tabular-nums">{row.absent}</span>,
    },
    {
      key: "justified",
      header: "Justificados",
      align: "right",
      sortValue: (row) => row.justified,
      cell: (row) => <span className="tabular-nums">{row.justified}</span>,
    },
    {
      key: "presentRate",
      header: "% Asistencia",
      sortValue: (row) => row.presentRate,
      cell: (row) => <RateBar value={row.presentRate} tone="success" />,
    },
    {
      key: "absentRate",
      header: "% Ausencia",
      sortValue: (row) => row.absentRate,
      cell: (row) => <RateBar value={row.absentRate} tone="destructive" />,
    },
    {
      key: "state",
      header: "Estado",
      sortValue: (row) => row.absentRate,
      cell: (row) => <AbsenceBandBadge rate={row.absentRate} />,
    },
  ];

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {info.subjectName} - {info.grade.name}
      </p>

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

      {atRisk.length > 0 ? (
        <SectionCard title="Estudiantes en Riesgo por Inasistencia (>20%)">
          <ul className="flex flex-col divide-y text-[13px]">
            {atRisk.map((entry) => (
              <li key={entry.studentId} className="flex items-center justify-between gap-2 py-2">
                <StudentLink screenId="ATT-02" studentId={entry.studentId}>
                  {nameOf(entry.studentId)}
                </StudentLink>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {entry.total - entry.present} ausencias de {entry.total}
                  <Badge variant="destructive">{formatPercent(entry.absentRate, 1)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="Tendencia Mensual">
        <MonthlyAttendanceChart
          months={monthlyTally(rows)}
          variant="line"
          ariaLabel="Tendencia mensual de asistencia del grupo"
        />
      </SectionCard>

      <EntityList
        title="Detalle por Estudiante"
        columns={columns}
        rows={perStudent}
        getRowId={(row) => row.studentId}
        searchText={(row) => [nameOf(row.studentId)]}
        searchPlaceholder="Buscar estudiante"
        emptyIcon={<ListChecks />}
        emptyTitle="Sin estudiantes"
        emptyDescription="No hay estudiantes activos en este grado."
        pageSize={15}
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
      />
    </>
  );
}
