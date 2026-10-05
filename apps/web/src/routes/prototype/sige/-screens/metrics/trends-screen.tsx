import { Callout } from "../../-components/callout";
import { CategoryBarChart, SeriesChart } from "../../-components/charts";
import { EmptyBlock } from "../../-components/empty-block";
import { MetricsActions, PassRateBar, ScoreText } from "../../-components/metric-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { monthLabel } from "../../-lib/class-stats";
import { formatPercent, formatScore } from "../../-lib/format";
import {
  monthlyAttendanceRate,
  periodTrends,
  trendDirection,
  type PeriodTrend,
} from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import type { Institution } from "../../-mock/types";

/** MET-03: period averages, pass rates and monthly attendance, with the overall trend callout. */
export function TrendsScreen() {
  return (
    <ScopedPage
      screenId="MET-03"
      title="Tendencias Académicas"
      description="Evolución del rendimiento a lo largo del año"
      target="Métricas"
      banner={false}
      actions={<MetricsActions />}
    >
      {(institution) => <Trends institution={institution} />}
    </ScopedPage>
  );
}

function stateOf(average: number) {
  if (average >= 3.5) return { label: "Aceptable", tone: "success" as const };
  if (average >= 3) return { label: "Regular", tone: "warning" as const };
  return { label: "Deficiente", tone: "destructive" as const };
}

function Trends({ institution }: { institution: Institution }) {
  const metrics = useMetrics(institution.id);
  const trends = periodTrends(metrics);
  const attendance = monthlyAttendanceRate(metrics);

  if (trends.length === 0) {
    return (
      <EmptyBlock
        title="No hay datos de periodos disponibles"
        description="Se necesitan periodos académicos con calificaciones registradas."
      />
    );
  }
  const direction = trendDirection(trends);

  const columns: TableColumn<PeriodTrend>[] = [
    {
      key: "period",
      header: "Periodo",
      cell: (row) => <span className="font-medium">{row.period.name}</span>,
    },
    {
      key: "average",
      header: "Promedio",
      align: "right",
      cell: (row) => <ScoreText value={row.average} />,
    },
    { key: "pass", header: "% Aprobación", cell: (row) => <PassRateBar value={row.passRate} /> },
    {
      key: "state",
      header: "Estado",
      cell: (row) => {
        const state = stateOf(row.average);
        return <ToneBadge tone={state.tone}>{state.label}</ToneBadge>;
      },
    },
  ];

  return (
    <>
      <Callout
        tone={direction === "deterioro" ? "destructive" : "info"}
        title="Análisis de Tendencia"
      >
        El rendimiento institucional muestra una tendencia de{" "}
        <strong className="text-foreground">{direction.toUpperCase()}</strong> en los últimos
        periodos analizados.
      </Callout>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Promedio Institucional por Periodo">
          <SeriesChart
            variant="line"
            ariaLabel="Promedio institucional por periodo"
            domain={[0, 5]}
            decimals
            series={[{ key: "average", label: "Promedio", color: "var(--chart-1)" }]}
            data={trends.map((entry) => ({
              label: entry.period.shortName,
              average: entry.average,
            }))}
          />
        </SectionCard>
        <SectionCard title="% Aprobación por Periodo">
          <CategoryBarChart
            ariaLabel="Porcentaje de aprobación por periodo"
            seriesLabel="% Aprobación"
            domain={[0, 100]}
            valueFormatter={(value) => formatPercent(value)}
            data={trends.map((entry) => ({
              label: entry.period.shortName,
              value: entry.passRate,
              color:
                entry.passRate >= 80
                  ? "var(--success)"
                  : entry.passRate >= 60
                    ? "var(--warning)"
                    : "var(--destructive)",
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard title="Tendencia de Asistencia Mensual">
        {attendance.length === 0 ? (
          <EmptyBlock title="No hay registros de asistencia disponibles." />
        ) : (
          <SeriesChart
            variant="line"
            ariaLabel="Porcentaje de asistencia por mes"
            domain={[0, 100]}
            decimals
            series={[{ key: "rate", label: "% Asistencia", color: "var(--info)" }]}
            data={attendance.map((entry) => ({ label: monthLabel(entry.month), rate: entry.rate }))}
          />
        )}
      </SectionCard>

      <SectionCard title="Detalle por Periodo">
        <SimpleTable columns={columns} rows={trends} getRowId={(row) => row.period.id} />
        <p className="text-xs text-muted-foreground">
          Promedio general{" "}
          {formatScore(trends.reduce((sum, row) => sum + row.average, 0) / trends.length)} sobre{" "}
          {trends.length} periodos con notas.
        </p>
      </SectionCard>
    </>
  );
}
