import { Button } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MonthlyAttendanceChart } from "../../-components/attendance-charts";
import { DonutChart } from "../../-components/charts";
import { ParentChildPage, type ChildContext } from "../../-components/parent-frame";
import { ScreenLinkButton } from "../../-components/link-button";
import { AttendanceStatusBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { monthlyTally, shareOf, tally } from "../../-lib/class-stats";
import {
  WEEKDAY_HEADERS,
  calendarCells,
  dayStatus,
  monthTitle,
  shiftMonth,
  type DayStatus,
} from "../../-lib/calendar";
import { capitalize, formatDate, formatPercent } from "../../-lib/format";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useStringParam } from "../../-lib/use-search-params";
import { REFERENCE_DATE } from "../../-mock";
import type { Attendance } from "../../-mock/types";

const DAY_CLASS: Record<DayStatus, string> = {
  presente: "bg-success/20 text-success",
  ausente: "bg-destructive/15 text-destructive",
  justificado: "bg-warning/30 text-foreground",
};

const DAY_LABEL: Record<DayStatus, string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
};

/** PAR-03: month navigator, monthly and yearly counters, calendar, charts and detail. */
export function ChildAttendanceScreen() {
  return (
    <ParentChildPage screenId="PAR-03" title="Asistencia del hijo/a" section="Asistencia">
      {(context) => <MonthlyAttendance {...context} />}
    </ParentChildPage>
  );
}

function MonthlyAttendance({ student, grading }: ChildContext) {
  const goTo = useGoToScreen();
  const month = useStringParam("month") ?? REFERENCE_DATE.slice(0, 7);
  const rows = grading.attendance
    .filter((row) => row.studentId === student.id)
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const ofMonth = rows.filter((row) => row.date.startsWith(month));
  const ofYear = rows.filter((row) => row.date.startsWith(month.slice(0, 4)));
  const monthTotals = tally(ofMonth);
  const yearTotals = tally(ofYear);
  const go = (delta: number) =>
    goTo("PAR-03", { student: String(student.id), month: shiftMonth(month, delta) });

  const columns: TableColumn<Attendance>[] = [
    {
      key: "date",
      header: "Fecha",
      sortValue: (row) => row.date,
      cell: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <AttendanceStatusBadge status={row.status} />,
    },
    {
      key: "observation",
      header: "Observación",
      cell: (row) => row.observation ?? <span className="text-muted-foreground">-</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        <Button variant="outline" size="sm" onClick={() => go(-1)}>
          <ChevronLeft data-icon="inline-start" />
          Anterior
        </Button>
        <span className="text-sm font-medium">{capitalize(monthTitle(month))}</span>
        <Button variant="outline" size="sm" onClick={() => go(1)}>
          Siguiente
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Estadísticas del Mes">
          <Counters totals={monthTotals} />
        </SectionCard>
        <SectionCard title={`Estadísticas del Año (${month.slice(0, 4)})`}>
          <Counters totals={yearTotals} annual />
        </SectionCard>
      </div>

      <SectionCard title={`Calendario - ${capitalize(monthTitle(month))}`}>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAY_HEADERS.map((day) => (
            <span key={day} className="py-1 font-medium text-muted-foreground">
              {day}
            </span>
          ))}
          {calendarCells(month).map((date, index) => {
            if (!date) return <span key={`blank-${index}`} aria-hidden="true" />;
            const status = dayStatus(ofMonth.filter((row) => row.date === date));
            return (
              <span
                key={date}
                title={`${date.slice(8)}/${date.slice(5, 7)}: ${status ? DAY_LABEL[status] : "Sin registro"}`}
                className={cn(
                  "rounded-md py-2 tabular-nums",
                  status ? DAY_CLASS[status] : "text-muted-foreground",
                )}
              >
                {Number(date.slice(8))}
              </span>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-3 text-xs">
          {(Object.keys(DAY_LABEL) as DayStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-sm", DAY_CLASS[status])} aria-hidden="true" />
              {DAY_LABEL[status]}
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Distribución del Mes">
          <DonutChart
            ariaLabel="Distribución de asistencia del mes"
            data={[
              { label: "Presentes", value: monthTotals.present, color: "var(--success)" },
              { label: "Ausentes", value: monthTotals.absent, color: "var(--destructive)" },
              { label: "Justificados", value: monthTotals.justified, color: "var(--warning)" },
            ]}
          />
        </SectionCard>
        <SectionCard title={`Asistencia Mensual - ${month.slice(0, 4)}`}>
          <MonthlyAttendanceChart
            months={monthlyTally(ofYear)}
            variant="bar"
            ariaLabel="Asistencia mensual por estado"
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Historial Detallado"
        action={
          <ScreenLinkButton screenId="ATT-02" size="sm" search={{ student: String(student.id) }}>
            Ver historial completo
          </ScreenLinkButton>
        }
      >
        <SimpleTable
          columns={columns}
          rows={ofMonth}
          getRowId={(row) => row.id}
          pageSize={10}
          empty={
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay registros de asistencia
            </p>
          }
        />
      </SectionCard>
    </>
  );
}

function Counters({
  totals,
  annual = false,
}: {
  totals: ReturnType<typeof tally>;
  annual?: boolean;
}) {
  const rate = shareOf(totals.present, totals.total);
  const cells = [
    { label: "Presentes", value: String(totals.present), className: "text-success" },
    { label: "Ausentes", value: String(totals.absent), className: "text-destructive" },
    { label: "Justificados", value: String(totals.justified), className: "text-foreground" },
    {
      label: annual ? "% Asistencia Anual" : "% Asistencia",
      value: formatPercent(rate, 1),
      className: "text-foreground",
    },
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="flex flex-col rounded-md bg-muted/50 px-2 py-2">
            <dd className={cn("text-xl font-semibold tabular-nums", cell.className)}>
              {cell.value}
            </dd>
            <dt className="text-xs text-muted-foreground">{cell.label}</dt>
          </div>
        ))}
      </dl>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Porcentaje de asistencia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
      >
        <div className="h-full bg-success" style={{ width: `${rate}%` }} />
      </div>
    </>
  );
}
