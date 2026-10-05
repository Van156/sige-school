import { Button } from "@base-template/ui/components/button";
import {
  Award,
  CalendarX,
  FileDown,
  Flame,
  GraduationCap,
  LineChart,
  Medal,
  Percent,
  Table2,
  TriangleAlert,
  Users,
} from "lucide-react";

import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { PerformanceTable, ScoreText } from "../../-components/metric-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { StudentLink } from "../../-components/student-link";
import { ToneBadge } from "../../-components/tone-badge";
import { formatPercent, formatScore, pluralize } from "../../-lib/format";
import {
  atRisk,
  campusPerformance,
  gradePerformance,
  studentSummaries,
  summarize,
  type StudentSummary,
} from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import { absenceRate, mockInfo } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** MET-01: institutional KPIs, performance by campus and course, top and at-risk students. */
export function InstitutionMetricsScreen() {
  return (
    <ScopedPage
      screenId="MET-01"
      title="Métricas Institucionales"
      description="Vista general del rendimiento académico"
      target="Métricas"
      banner={false}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => mockInfo("Exportar Excel", "La descarga no existe en el prototipo.")}
          >
            <FileDown data-icon="inline-start" />
            Exportar Excel
          </Button>
          <ScreenLinkButton screenId="MET-02">
            <Table2 data-icon="inline-start" />
            Mapa de Calor
          </ScreenLinkButton>
          <ScreenLinkButton screenId="MET-03">
            <LineChart data-icon="inline-start" />
            Tendencias
          </ScreenLinkButton>
          <ScreenLinkButton screenId="MET-04">
            <Users data-icon="inline-start" />
            Comparativa Docentes
          </ScreenLinkButton>
        </>
      }
    >
      {(institution) => <InstitutionMetrics institution={institution} />}
    </ScopedPage>
  );
}

function InstitutionMetrics({ institution }: { institution: Institution }) {
  const metrics = useMetrics(institution.id);
  const summaries = studentSummaries(metrics);
  const overall = summarize(metrics.finals);
  const risky = atRisk(summaries);
  const ids = new Set(metrics.activeStudents.map((student) => student.id));
  const absence = absenceRate(metrics.grading.attendance.filter((row) => ids.has(row.studentId)));

  const graded = summaries.filter((entry) => entry.average !== null);
  const top = graded.toSorted((a, b) => (b.average ?? 0) - (a.average ?? 0)).slice(0, 10);
  const worst = risky.toSorted((a, b) => (a.average ?? 0) - (b.average ?? 0)).slice(0, 10);

  const nameCell = (row: StudentSummary) => (
    <StudentLink screenId="STU-02" studentId={row.student.id}>
      {row.name}
    </StudentLink>
  );
  const topColumns: TableColumn<StudentSummary>[] = [
    {
      key: "rank",
      header: "#",
      cell: (row) => {
        const position = top.indexOf(row) + 1;
        return position <= 3 ? (
          <Medal className="size-4 text-warning" aria-label={`Puesto ${position}`} />
        ) : (
          position
        );
      },
    },
    { key: "student", header: "Estudiante", cell: nameCell },
    { key: "course", header: "Grado", cell: (row) => row.course },
    {
      key: "average",
      header: "Promedio",
      align: "right",
      cell: (row) => <ScoreText value={row.average} />,
    },
    {
      key: "state",
      header: "Estado",
      cell: (row) =>
        row.failedSubjects === 0 ? (
          <ToneBadge tone="success">Sin pérdidas</ToneBadge>
        ) : (
          <ToneBadge tone="warning">
            {pluralize(row.failedSubjects, "pérdida", "pérdidas")}
          </ToneBadge>
        ),
    },
  ];
  const riskColumns: TableColumn<StudentSummary>[] = [
    { key: "student", header: "Estudiante", cell: nameCell },
    { key: "course", header: "Grado", cell: (row) => row.course },
    {
      key: "average",
      header: "Promedio",
      align: "right",
      cell: (row) => <ScoreText value={row.average} />,
    },
    {
      key: "failed",
      header: "Materias Perdidas",
      align: "right",
      cell: (row) => <ToneBadge tone="destructive">{row.failedSubjects}</ToneBadge>,
    },
  ];

  return (
    <>
      <StatGrid>
        <StatTile
          label="Promedio Institucional"
          value={overall.average === null ? "-" : formatScore(overall.average)}
          icon={Award}
        />
        <StatTile
          label="% Aprobación General"
          value={formatPercent(overall.passRate, 1)}
          icon={Percent}
          tone="success"
        />
        <StatTile
          label="Estudiantes en Riesgo"
          value={risky.length}
          icon={TriangleAlert}
          tone="destructive"
        />
        <StatTile
          label="Tasa de Inasistencia"
          value={formatPercent(absence, 1)}
          icon={CalendarX}
          tone="warning"
        />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Rendimiento por Sede">
          <PerformanceTable
            rows={campusPerformance(metrics, summaries)}
            labelHeader="Sede"
            emptyText="No hay datos de sedes disponibles."
          />
        </SectionCard>
        <SectionCard title="Rendimiento por Grado">
          <PerformanceTable
            rows={gradePerformance(metrics, summaries)}
            labelHeader="Grado"
            sublabelHeader="Sede"
            emptyText="No hay datos de grados disponibles."
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Top 10 Mejores Estudiantes">
          <SimpleTable
            columns={topColumns}
            rows={top}
            getRowId={(row) => row.student.id}
            empty={
              <EmptyBlock
                icon={<GraduationCap />}
                title="No hay datos de estudiantes disponibles."
              />
            }
          />
        </SectionCard>
        <SectionCard title="Top 10 Estudiantes en Riesgo">
          <SimpleTable
            columns={riskColumns}
            rows={worst}
            getRowId={(row) => row.student.id}
            empty={<EmptyBlock icon={<Flame />} title="No hay estudiantes en riesgo académico." />}
          />
        </SectionCard>
      </div>
    </>
  );
}
