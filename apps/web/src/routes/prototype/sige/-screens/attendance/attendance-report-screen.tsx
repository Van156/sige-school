import { TableCell, TableRow } from "@base-template/ui/components/table";
import { Field, FieldLabel } from "@base-template/ui/components/field";
import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { FileDown, Printer } from "lucide-react";

import { ATTENDANCE_SERIES } from "../../-components/attendance-charts";
import { SeriesChart } from "../../-components/charts";
import { ClassContext, type ClassInfo } from "../../-components/class-context";
import { BackButton } from "../../-components/form-layout";
import { EmptyBlock } from "../../-components/empty-block";
import { PrintStyles } from "../../-components/print-styles";
import { ScopedPage } from "../../-components/scoped-page";
import { AbsenceBandBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { attendanceByStudent, tally, type StudentAttendanceRow } from "../../-lib/class-stats";
import { formatDate, formatPercent } from "../../-lib/format";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam, useStringParam } from "../../-lib/use-search-params";
import { REFERENCE_DATE, addDays, mockInfo, round } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** Default range: the 30 days up to the reference date (the window used by the absence alerts). */
const DEFAULT_FROM = addDays(REFERENCE_DATE, -30);

/** ATT-04: printable attendance report of a subject-grade over a date range (`?sg=&from=&to=`). */
export function AttendanceReportScreen() {
  const subjectGrade = useIntParam("sg");
  return (
    <ScopedPage
      screenId="ATT-04"
      title="Reporte de Asistencia"
      description="Asistencia por rango de fechas, lista para imprimir"
      target="Asistencia"
      banner={false}
      actions={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            onClick={() => mockInfo("CSV", "La descarga no existe en el prototipo.")}
          >
            <FileDown data-icon="inline-start" />
            CSV
          </Button>
          <BackButton
            screenId="ATT-03"
            search={{ sg: subjectGrade === undefined ? undefined : String(subjectGrade) }}
          />
        </div>
      }
    >
      {(institution) => <ReportView institution={institution} />}
    </ScopedPage>
  );
}

function ReportView({ institution }: { institution: Institution }) {
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
      {(info) => <Report info={info} school={school} grading={grading} />}
    </ClassContext>
  );
}

function Report({ info, school, grading }: { info: ClassInfo; school: School; grading: Grading }) {
  const goTo = useGoToScreen();
  const from = useStringParam("from") ?? DEFAULT_FROM;
  const to = useStringParam("to") ?? REFERENCE_DATE;
  const search = (patch: { from?: string; to?: string }) => ({
    sg: String(info.subjectGrade.id),
    from,
    to,
    ...patch,
  });

  const rows = grading.attendance.filter(
    (row) => row.subjectGradeId === info.subjectGrade.id && row.date >= from && row.date <= to,
  );
  const totals = tally(rows);
  const perStudent = attendanceByStudent(
    info.students.map((student) => student.id),
    rows,
  );
  const nameOf = (studentId: number) =>
    school.userName(school.studentById.get(studentId)?.userId ?? -1) ?? "Estudiante";

  const dates = [...new Set(rows.map((row) => row.date))].sort();
  const daily = dates.map((date) => {
    const day = tally(rows.filter((row) => row.date === date));
    return {
      label: date.slice(5),
      present: day.present,
      absent: day.absent,
      justified: day.justified,
    };
  });

  const columns: TableColumn<StudentAttendanceRow>[] = [
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => nameOf(row.studentId),
      cell: (row) => nameOf(row.studentId),
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
      align: "right",
      sortValue: (row) => row.presentRate,
      cell: (row) => <span className="tabular-nums">{formatPercent(row.presentRate, 1)}</span>,
    },
    {
      key: "absentRate",
      header: "% Ausencia",
      align: "right",
      sortValue: (row) => row.absentRate,
      cell: (row) => <span className="tabular-nums">{formatPercent(row.absentRate, 1)}</span>,
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
      <PrintStyles />
      <SectionCard title="Rango del reporte" className="print:hidden">
        <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="report-from">Desde</FieldLabel>
            <Input
              id="report-from"
              type="date"
              value={from}
              max={to}
              onChange={(event) =>
                goTo("ATT-04", search({ from: event.target.value || DEFAULT_FROM }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="report-to">Hasta</FieldLabel>
            <Input
              id="report-to"
              type="date"
              value={to}
              min={from}
              onChange={(event) =>
                goTo("ATT-04", search({ to: event.target.value || REFERENCE_DATE }))
              }
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold">Reporte de Asistencia</h2>
          <p className="text-sm text-muted-foreground">
            {info.subjectName} - {info.grade.name} · {formatDate(from)} a {formatDate(to)}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyBlock
            title="Sin registros"
            description="No hay registros de asistencia en el periodo seleccionado."
          />
        ) : (
          <>
            <StatGrid>
              <StatTile label="Total Registros" value={totals.total} />
              <StatTile label="Presentes" value={totals.present} tone="success" />
              <StatTile label="Ausentes" value={totals.absent} tone="destructive" />
              <StatTile label="Justificados" value={totals.justified} tone="warning" />
            </StatGrid>

            <SectionCard title="Asistencia por día">
              <SeriesChart
                stacked
                ariaLabel="Asistencia diaria del rango: presentes, ausentes y justificados"
                series={ATTENDANCE_SERIES}
                data={daily}
              />
            </SectionCard>

            <SectionCard title="Detalle por Estudiante">
              <SimpleTable
                columns={columns}
                rows={perStudent}
                getRowId={(row) => row.studentId}
                pageSize={15}
                footer={
                  <TableRow>
                    <TableCell className="font-medium">Totales</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.present}</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.absent}</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.justified}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(
                        totals.total === 0 ? 100 : round((totals.present / totals.total) * 100, 1),
                        1,
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(
                        totals.total === 0
                          ? 0
                          : round(((totals.total - totals.present) / totals.total) * 100, 1),
                        1,
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                }
              />
            </SectionCard>
          </>
        )}
      </div>
    </>
  );
}
