import { Award, CalendarCheck, GraduationCap, Link2 } from "lucide-react";

import { ScatterPlot } from "../../-components/charts";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { PassRateBar } from "../../-components/metric-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { StudentLink } from "../../-components/student-link";
import { TeacherSelect } from "../../-components/teacher-select";
import { ToneBadge } from "../../-components/tone-badge";
import { formatScore } from "../../-lib/format";
import {
  QUADRANT_LABEL,
  attendanceVsGrades,
  correlationLabel,
  pearson,
  regressionSegment,
  type Quadrant,
  type ScatterPoint,
} from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import { useTeacherScope } from "../../-lib/use-teacher-scope";
import { average, fullName, round } from "../../-mock";
import type { BadgeTone } from "../../-lib/roles";
import type { Institution } from "../../-mock/types";

const QUADRANT_COLOR: Record<Quadrant, string> = {
  optimo: "var(--success)",
  refuerzo: "var(--info)",
  asistencia: "var(--warning)",
  critico: "var(--destructive)",
};

const QUADRANT_TONE: Record<Quadrant, BadgeTone> = {
  optimo: "success",
  refuerzo: "info",
  asistencia: "warning",
  critico: "destructive",
};

const QUADRANT_FULL: Record<Quadrant, string> = {
  optimo: "Óptimo (Asist. >= 80%, Nota >= 3.0)",
  refuerzo: "Refuerzo Académico (Asist. >= 80%, Nota < 3.0)",
  asistencia: "Atención Asistencia (Asist. < 80%, Nota >= 3.0)",
  critico: "Crítico (Asist. < 80%, Nota < 3.0)",
};

const QUADRANTS = Object.keys(QUADRANT_LABEL) as Quadrant[];

/** MET-06: scatter of attendance against grades per student of one teacher, with patterns. */
export function AttendancePerformanceScreen() {
  return (
    <ScopedPage
      screenId="MET-06"
      title="Asistencia vs Rendimiento"
      description="Correlación entre asistencia y notas de los estudiantes a cargo"
      target="Métricas"
      banner={false}
      actions={<BackButton screenId="MET-05" label="Volver al Dashboard" />}
    >
      {(institution) => <Correlation institution={institution} />}
    </ScopedPage>
  );
}

function Correlation({ institution }: { institution: Institution }) {
  const metrics = useMetrics(institution.id);
  const scope = useTeacherScope(metrics.school);
  const teacher =
    scope.teacherId === undefined ? undefined : metrics.school.userById.get(scope.teacherId);
  const points = scope.teacherId === undefined ? [] : attendanceVsGrades(metrics, scope.teacherId);
  const r = pearson(points);
  const low = points.filter((point) => point.attendance < 80);
  const critical = points.filter((point) => point.quadrant === "critico");
  const count = (quadrant: Quadrant) =>
    points.filter((point) => point.quadrant === quadrant).length;

  const columns: TableColumn<ScatterPoint>[] = [
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => row.name,
      cell: (row) => (
        <StudentLink screenId="STU-02" studentId={row.studentId}>
          {row.name}
        </StudentLink>
      ),
    },
    { key: "course", header: "Grado", sortValue: (row) => row.course, cell: (row) => row.course },
    {
      key: "attendance",
      header: "% Asistencia",
      sortValue: (row) => row.attendance,
      cell: (row) => <PassRateBar value={row.attendance} />,
    },
    {
      key: "average",
      header: "Promedio Notas",
      align: "right",
      sortValue: (row) => row.average,
      cell: (row) => <span className="tabular-nums">{formatScore(row.average)}</span>,
    },
    {
      key: "state",
      header: "Estado",
      sortValue: (row) => row.quadrant,
      cell: (row) => (
        <ToneBadge tone={QUADRANT_TONE[row.quadrant]}>{QUADRANT_LABEL[row.quadrant]}</ToneBadge>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {teacher ? (
          <p className="text-sm text-muted-foreground">
            Analizando: <strong className="text-foreground">{fullName(teacher)}</strong>
          </p>
        ) : null}
        <TeacherSelect screenId="MET-06" scope={scope} />
      </div>

      {points.length === 0 ? (
        <EmptyBlock
          icon={<GraduationCap />}
          title="No hay datos de asistencia y notas disponibles."
        />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Estudiantes Analizados" value={points.length} icon={GraduationCap} />
            <StatTile
              label="Asistencia Promedio"
              value={`${round(average(points.map((point) => point.attendance)) ?? 0, 1)}%`}
              icon={CalendarCheck}
              tone="info"
            />
            <StatTile
              label="Nota Promedio"
              value={formatScore(average(points.map((point) => point.average)) ?? 0)}
              icon={Award}
            />
            <StatTile
              label="Correlación"
              value={r === null ? "-" : r.toFixed(2)}
              icon={Link2}
              hint={correlationLabel(r)}
            />
          </StatGrid>

          <SectionCard title="Gráfico de Dispersión: Asistencia vs Notas">
            <ScatterPlot
              ariaLabel="Dispersión de asistencia frente a promedio de notas por estudiante"
              xLabel="% Asistencia"
              yLabel="Promedio de Notas"
              xDomain={[
                Math.max(0, Math.floor(Math.min(...points.map((p) => p.attendance)) / 10) * 10 - 5),
                100,
              ]}
              yDomain={[1, 5]}
              trend={regressionSegment(points)}
              describe={(point) =>
                `${point.name} (${point.course}) · Asistencia ${point.attendance}% · Nota ${formatScore(point.average)}`
              }
              series={QUADRANTS.map((quadrant) => ({
                key: quadrant,
                label: QUADRANT_FULL[quadrant],
                color: QUADRANT_COLOR[quadrant],
                points: points
                  .filter((point) => point.quadrant === quadrant)
                  .map((point) => ({ ...point, x: point.attendance, y: point.average })),
              }))}
            />
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Patrones Identificados">
              <dl className="grid grid-cols-2 gap-2 text-center">
                {(
                  [
                    ["Aprueban + Buena Asistencia", count("optimo")],
                    ["Aprueban + Baja Asistencia", count("asistencia")],
                    ["Reprueban + Buena Asistencia", count("refuerzo")],
                    ["Reprueban + Baja Asistencia", count("critico")],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col rounded-md bg-muted/50 px-2 py-2">
                    <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                  </div>
                ))}
              </dl>
              {low.length === 0 && critical.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No se identificaron patrones de riesgo.
                </p>
              ) : (
                <>
                  <PatternList
                    title="Baja Asistencia (< 80%)"
                    points={low}
                    detail={(p) => `${p.attendance}%`}
                  />
                  <PatternList
                    title="Críticos (Baja Asistencia + Notas Bajas)"
                    points={critical}
                    detail={(p) => `${formatScore(p.average, 1)} · ${p.attendance}%`}
                  />
                </>
              )}
            </SectionCard>

            <SectionCard title="Detalle por Estudiante">
              <SimpleTable
                columns={columns}
                rows={points}
                getRowId={(row) => row.studentId}
                pageSize={8}
              />
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}

function PatternList({
  title,
  points,
  detail,
}: {
  title: string;
  points: readonly ScatterPoint[];
  detail: (point: ScatterPoint) => string;
}) {
  if (points.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-medium">{title}</h3>
      <ul className="flex flex-col gap-1 text-[13px]">
        {points.slice(0, 5).map((point) => (
          <li key={point.studentId} className="flex items-center justify-between gap-2">
            <span className="truncate">{point.name}</span>
            <ToneBadge tone="warning">{detail(point)}</ToneBadge>
          </li>
        ))}
        {points.length > 5 ? (
          <li className="text-xs text-muted-foreground">+{points.length - 5} más</li>
        ) : null}
      </ul>
    </div>
  );
}
