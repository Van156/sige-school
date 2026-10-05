import { Award, Percent, Trophy, Users } from "lucide-react";

import { CategoryBarChart, DonutChart } from "../../-components/charts";
import { EmptyBlock } from "../../-components/empty-block";
import { MetricsActions, PassRateBar, ScoreText } from "../../-components/metric-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge } from "../../-components/tone-badge";
import { formatPercent, formatScore } from "../../-lib/format";
import { teacherComparison, type TeacherRow } from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import { average } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** MET-04: anonymous teacher ranking (letters ordered by average), table and two charts. */
export function TeacherComparisonScreen() {
  return (
    <ScopedPage
      screenId="MET-04"
      title="Comparativa Anónima de Docentes"
      description="Rendimiento anonimizado por profesor (A, B, C...)"
      target="Métricas"
      banner={false}
      actions={<MetricsActions />}
    >
      {(institution) => <Comparison institution={institution} />}
    </ScopedPage>
  );
}

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function bandColor(value: number) {
  return value >= 4 ? "var(--success)" : value >= 3 ? "var(--warning)" : "var(--destructive)";
}

function Comparison({ institution }: { institution: Institution }) {
  const metrics = useMetrics(institution.id);
  const rows = teacherComparison(metrics);

  if (rows.length === 0) {
    return (
      <EmptyBlock
        icon={<Users />}
        title="No hay datos de docentes disponibles"
        description="Se necesitan docentes con grupos y calificaciones asignadas."
      />
    );
  }
  const best = rows.reduce((top, row) => (row.passRate > top.passRate ? row : top), rows[0]!);

  const columns: TableColumn<TeacherRow>[] = [
    {
      key: "teacher",
      header: "Profesor",
      sortValue: (row) => row.letter,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          {row.letter === "A" ? <Trophy className="size-4 text-warning" /> : null}
          Profesor {row.letter}
        </span>
      ),
    },
    {
      key: "groups",
      header: "Grupos",
      align: "right",
      sortValue: (row) => row.groups,
      cell: (row) => <ToneBadge tone="secondary">{row.groups}</ToneBadge>,
    },
    {
      key: "students",
      header: "Estudiantes",
      align: "right",
      sortValue: (row) => row.students,
      cell: (row) => <ToneBadge tone="secondary">{row.students}</ToneBadge>,
    },
    {
      key: "average",
      header: "Promedio",
      align: "right",
      sortValue: (row) => row.average,
      cell: (row) => <ScoreText value={row.average} />,
    },
    {
      key: "pass",
      header: "% Aprobación",
      sortValue: (row) => row.passRate,
      cell: (row) => <PassRateBar value={row.passRate} />,
    },
    {
      key: "percentile",
      header: "Percentil",
      align: "right",
      sortValue: (row) => row.percentile,
      cell: (row) => (
        <ToneBadge
          tone={row.percentile >= 75 ? "success" : row.percentile >= 40 ? "warning" : "destructive"}
        >
          {row.percentile}%
        </ToneBadge>
      ),
    },
  ];

  return (
    <>
      <StatGrid>
        <StatTile label="Total Docentes" value={rows.length} icon={Users} />
        <StatTile
          label="Promedio General"
          value={formatScore(average(rows.map((row) => row.average)) ?? 0)}
          icon={Award}
        />
        <StatTile
          label="Mejor Percentil"
          value="100%"
          icon={Trophy}
          hint="Profesor A"
          tone="success"
        />
        <StatTile
          label="Mejor % Aprobación"
          value={formatPercent(best.passRate, 1)}
          icon={Percent}
          hint={`Profesor ${best.letter}`}
          tone="success"
        />
      </StatGrid>

      <SectionCard title="Tabla Comparativa Anónima">
        <SimpleTable columns={columns} rows={rows} getRowId={(row) => row.teacherId} />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Comparativa de Promedios">
          <CategoryBarChart
            ariaLabel="Promedio por profesor anónimo"
            seriesLabel="Promedio"
            domain={[0, 5]}
            valueFormatter={(value) => formatScore(value, 1)}
            data={rows.map((row) => ({
              label: row.letter,
              value: row.average,
              color: bandColor(row.average),
            }))}
          />
        </SectionCard>
        <SectionCard title="Distribución de Aprobación">
          <DonutChart
            ariaLabel="Porcentaje de aprobación por profesor anónimo"
            data={rows.map((row, index) => ({
              label: `Profesor ${row.letter}`,
              value: row.passRate,
              color: PALETTE[index % PALETTE.length] ?? "var(--chart-1)",
            }))}
          />
        </SectionCard>
      </div>
    </>
  );
}
