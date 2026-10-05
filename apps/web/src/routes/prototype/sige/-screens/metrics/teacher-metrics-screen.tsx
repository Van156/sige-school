import { Badge } from "@base-template/ui/components/badge";
import { Award, CalendarX, CheckCircle2, GraduationCap, Percent, Users } from "lucide-react";

import { ActionLink } from "../../-components/action-link";
import { CategoryBarChart, SeriesChart } from "../../-components/charts";
import { EmptyBlock } from "../../-components/empty-block";
import { PassRateBar, ScoreText } from "../../-components/metric-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { StudentLink } from "../../-components/student-link";
import { TeacherSelect } from "../../-components/teacher-select";
import { ToneBadge } from "../../-components/tone-badge";
import { formatPercent, formatScore } from "../../-lib/format";
import { teacherOverview, type StudentSummary, type TeacherClassRow } from "../../-lib/metrics";
import { useMetrics, type Metrics } from "../../-lib/use-metrics";
import { useTeacherScope, type TeacherScope } from "../../-lib/use-teacher-scope";
import { fullName } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** MET-05: analytics of one teacher (own for teachers, selectable for management). */
export function TeacherMetricsScreen() {
  return (
    <ScopedPage
      screenId="MET-05"
      title="Métricas del Docente"
      description="Rendimiento, asistencia y planes de acción por docente"
      target="Métricas"
      banner={false}
    >
      {(institution) => <TeacherMetrics institution={institution} />}
    </ScopedPage>
  );
}

function TeacherMetrics({ institution }: { institution: Institution }) {
  const metrics = useMetrics(institution.id);
  const scope = useTeacherScope(metrics.school);
  const teacher =
    scope.teacherId === undefined ? undefined : metrics.school.userById.get(scope.teacherId);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {teacher ? (
          <p className="text-sm text-muted-foreground">
            Analizando: <strong className="text-foreground">{fullName(teacher)}</strong>
          </p>
        ) : null}
        <TeacherSelect screenId="MET-05" scope={scope} />
      </div>
      {scope.teacherId === undefined ? (
        <EmptyBlock icon={<Users />} title="No hay docentes con asignaturas" />
      ) : (
        <Overview metrics={metrics} teacherId={scope.teacherId} scope={scope} />
      )}
    </>
  );
}

function Overview({
  metrics,
  teacherId,
  scope,
}: {
  metrics: Metrics;
  teacherId: number;
  scope: TeacherScope;
}) {
  const overview = teacherOverview(metrics, teacherId);
  const search = scope.canSwitch ? { teacher: String(teacherId) } : undefined;

  const classColumns: TableColumn<TeacherClassRow>[] = [
    {
      key: "course",
      header: "Grupo",
      sortValue: (row) => row.course,
      cell: (row) => <span className="font-medium">{row.course}</span>,
    },
    {
      key: "subject",
      header: "Materia",
      sortValue: (row) => row.subject,
      cell: (row) => row.subject,
    },
    {
      key: "students",
      header: "Estudiantes",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.students}</span>,
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
      cell: (row) => (row.passRate === null ? "-" : <PassRateBar value={row.passRate} />),
    },
    {
      key: "risk",
      header: "En Riesgo",
      align: "right",
      cell: (row) =>
        row.atRisk > 0 ? (
          <ToneBadge tone="destructive">{row.atRisk}</ToneBadge>
        ) : (
          <span className="tabular-nums">0</span>
        ),
    },
  ];
  const riskColumns: TableColumn<StudentSummary>[] = [
    {
      key: "student",
      header: "Estudiante",
      cell: (row) => (
        <StudentLink screenId="STU-02" studentId={row.student.id}>
          {row.name}
        </StudentLink>
      ),
    },
    { key: "course", header: "Grado", cell: (row) => row.course },
    {
      key: "average",
      header: "Promedio",
      align: "right",
      cell: (row) => <ToneBadge tone="destructive">{formatScore(row.average ?? 0)}</ToneBadge>,
    },
    {
      key: "failed",
      header: "Materias Afectadas",
      align: "right",
      cell: (row) => row.failedSubjects,
    },
  ];

  return (
    <>
      <StatGrid>
        <StatTile
          label="Promedio General"
          value={overview.overall.average === null ? "-" : formatScore(overview.overall.average)}
          icon={Award}
        />
        <StatTile
          label="% Aprobación"
          value={formatPercent(overview.overall.passRate, 1)}
          icon={Percent}
          tone="success"
        />
        <StatTile
          label="Inasistencias"
          value={formatPercent(overview.absenceRate, 1)}
          icon={CalendarX}
          tone="warning"
          hint={`${overview.absences} totales`}
        />
        <StatTile
          label="Estudiantes a Cargo"
          value={overview.studentsInCharge}
          icon={GraduationCap}
        />
      </StatGrid>

      <SectionCard title="Planes de Acción Sugeridos">
        {overview.suggestions.length === 0 ? (
          <EmptyBlock
            icon={<CheckCircle2 />}
            title="¡Todo en orden!"
            description="No se han detectado desviaciones críticas que requieran intervención inmediata."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {overview.suggestions.map((suggestion) => (
              <article key={suggestion.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{suggestion.subject}</h3>
                  <Badge variant="secondary">{suggestion.course}</Badge>
                </div>
                <p className="text-[13px] text-muted-foreground">{suggestion.text}</p>
                <Badge variant="outline" className="self-start">
                  {suggestion.chip}
                </Badge>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Análisis por Grupo">
        <SimpleTable
          columns={classColumns}
          rows={overview.classRows}
          getRowId={(row) => row.subjectGradeId}
          empty={
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay datos de grupos disponibles.
            </p>
          }
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Distribución de Notas">
          {overview.finals.length === 0 ? (
            <EmptyBlock title="No hay datos de notas disponibles." />
          ) : (
            <CategoryBarChart
              ariaLabel="Distribución de notas finales por rango"
              seriesLabel="Notas"
              data={overview.distribution}
            />
          )}
        </SectionCard>
        <SectionCard title="Tendencia por Periodo">
          {overview.trend.length === 0 ? (
            <EmptyBlock title="No hay datos de periodos disponibles." />
          ) : (
            <SeriesChart
              variant="line"
              ariaLabel="Promedio por periodo frente al mínimo aprobatorio"
              domain={[0, 5]}
              decimals
              series={[
                { key: "average", label: "Promedio General", color: "var(--chart-1)" },
                { key: "minimum", label: "Mínimo aprobatorio (3.0)", color: "var(--destructive)" },
              ]}
              data={overview.trend.map((entry) => ({
                label: entry.period.shortName,
                average: entry.average,
                minimum: 3,
              }))}
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Estudiantes en Riesgo"
        action={
          <Badge variant="outline">{overview.riskStudents.length} con promedio &lt; 3.0</Badge>
        }
      >
        <SimpleTable
          columns={riskColumns}
          rows={overview.riskStudents}
          getRowId={(row) => row.student.id}
          empty={
            <EmptyBlock
              icon={<CheckCircle2 />}
              title="No hay estudiantes en riesgo. ¡Excelente trabajo!"
            />
          }
        />
      </SectionCard>

      <div className="grid gap-3 md:grid-cols-2">
        {scope.canSwitch ? (
          <ActionLink
            screenId="MET-04"
            icon={Users}
            title="Comparativa Anónima"
            subtitle="Tu rendimiento vs. promedio institucional"
          />
        ) : null}
        <ActionLink
          screenId="MET-06"
          icon={CalendarX}
          title="Asistencia vs Rendimiento"
          subtitle="Correlación asistencia-notas"
          search={search}
        />
      </div>
    </>
  );
}
