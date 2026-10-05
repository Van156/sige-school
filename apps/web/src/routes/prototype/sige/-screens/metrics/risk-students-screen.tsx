import { Button } from "@base-template/ui/components/button";
import { CheckCircle2, Eye, Flame, TriangleAlert } from "lucide-react";

import { Callout } from "../../-components/callout";
import { DonutChart } from "../../-components/charts";
import { EmptyBlock } from "../../-components/empty-block";
import { FilterSelect } from "../../-components/filter-select";
import { IconLink } from "../../-components/icon-link";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge } from "../../-components/tone-badge";
import { formatScore } from "../../-lib/format";
import { atRisk, studentSummaries, teacherOverview, type StudentSummary } from "../../-lib/metrics";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useRole } from "../../-lib/use-role";
import { useStringParam } from "../../-lib/use-search-params";
import { useMetrics } from "../../-lib/use-metrics";
import { useTeacherScope } from "../../-lib/use-teacher-scope";
import { dashboardScreenId } from "../../-screens";
import type { Institution } from "../../-mock/types";

const THRESHOLDS = [
  { value: "1", label: "1.0 - Solo desempeño muy bajo" },
  { value: "1.5", label: "1.5 - Riesgo extremo" },
  { value: "2", label: "2.0 - Riesgo alto" },
  { value: "2.5", label: "2.5 - Riesgo medio-alto" },
  { value: "3", label: "3.0 - Incluye desempeño básico bajo" },
] as const;

/** MET-07: students whose mean falls below a configurable threshold (`?threshold=`). */
export function RiskStudentsScreen() {
  const role = useRole();
  return (
    <ScopedPage
      screenId="MET-07"
      title="Estudiantes en Riesgo"
      description={
        role === "teacher"
          ? "Estudiantes con rendimiento bajo en tus asignaturas"
          : "Estudiantes con rendimiento bajo en la institución"
      }
      target="Métricas"
      banner={false}
    >
      {(institution) => <Risk institution={institution} />}
    </ScopedPage>
  );
}

function Risk({ institution }: { institution: Institution }) {
  const goTo = useGoToScreen();
  const role = useRole();
  const metrics = useMetrics(institution.id);
  const scope = useTeacherScope(metrics.school);
  const requested = Number(useStringParam("threshold"));
  const threshold = THRESHOLDS.find((entry) => Number(entry.value) === requested)?.value ?? "3";

  const summaries =
    role === "teacher" && scope.teacherId !== undefined
      ? teacherOverview(metrics, scope.teacherId).summaries
      : studentSummaries(metrics);
  const rows = atRisk(summaries, Number(threshold)).toSorted(
    (a, b) => (a.average ?? 0) - (b.average ?? 0),
  );
  const critical = rows.filter((row) => (row.average ?? 0) < 2).length;

  const columns: TableColumn<StudentSummary>[] = [
    { key: "rank", header: "#", cell: (row) => rows.indexOf(row) + 1 },
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => row.name,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: "course", header: "Grado", sortValue: (row) => row.course, cell: (row) => row.course },
    {
      key: "average",
      header: "Promedio",
      align: "right",
      sortValue: (row) => row.average,
      cell: (row) => (
        <ToneBadge tone={(row.average ?? 0) < 2 ? "destructive" : "warning"}>
          {formatScore(row.average ?? 0)}
        </ToneBadge>
      ),
    },
    {
      key: "subjects",
      header: "Asignaturas",
      align: "right",
      sortValue: (row) => row.failedSubjects,
      cell: (row) => <span className="tabular-nums">{row.failedSubjects}</span>,
    },
    {
      key: "state",
      header: "Estado",
      cell: (row) =>
        (row.average ?? 0) < 2 ? (
          <ToneBadge tone="destructive">Crítico</ToneBadge>
        ) : (
          <ToneBadge tone="warning">Alerta</ToneBadge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-12",
      cell: (row) => (
        <IconLink
          screenId="STU-02"
          search={{ id: String(row.student.id) }}
          label={`Ver perfil de ${row.name}`}
        >
          <Eye />
        </IconLink>
      ),
    },
  ];

  return (
    <>
      <SectionCard title="Filtro">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground">
            Umbral de Riesgo (promedio menor a):
          </span>
          <FilterSelect
            label="Umbral de riesgo"
            value={threshold}
            onValueChange={(value) => goTo("MET-07", { threshold: value })}
            options={THRESHOLDS}
          />
          <Button variant="ghost" size="sm" onClick={() => goTo("MET-07")}>
            Restablecer
          </Button>
        </div>
      </SectionCard>

      {rows.length === 0 ? (
        <EmptyBlock
          icon={<CheckCircle2 />}
          title="¡No hay estudiantes en riesgo!"
          description={`Todos los estudiantes tienen promedios iguales o superiores al umbral de ${threshold}.`}
          action={
            <ScreenLinkButton screenId={dashboardScreenId[role]}>
              Volver al Dashboard
            </ScreenLinkButton>
          }
        />
      ) : (
        <>
          <StatGrid columns={3}>
            <StatTile
              label="Total en Riesgo"
              value={rows.length}
              icon={TriangleAlert}
              tone="destructive"
            />
            <StatTile label="Riesgo Alto (<2.0)" value={critical} icon={Flame} tone="destructive" />
            <StatTile
              label="Riesgo Medio (2.0-2.9)"
              value={rows.length - critical}
              icon={TriangleAlert}
              tone="warning"
            />
          </StatGrid>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard title="Lista de Estudiantes en Riesgo" className="xl:col-span-2">
              <SimpleTable
                columns={columns}
                rows={rows}
                getRowId={(row) => row.student.id}
                pageSize={10}
              />
            </SectionCard>
            <div className="flex flex-col gap-4">
              <SectionCard title="Distribución de Riesgo">
                <DonutChart
                  ariaLabel="Distribución de estudiantes en riesgo alto y medio"
                  data={[
                    { label: "Riesgo Alto (<2.0)", value: critical, color: "var(--destructive)" },
                    {
                      label: "Riesgo Medio (2.0+)",
                      value: rows.length - critical,
                      color: "var(--warning)",
                    },
                  ]}
                />
              </SectionCard>
              <Callout title={`Umbral actual: ${threshold}`}>
                Estudiantes con promedio menor a este valor se consideran en riesgo. Crítico:
                promedio menor a 2.0 (desempeño Bajo). Alerta: entre 2.0 y el umbral (desempeño
                Básico bajo).
              </Callout>
            </div>
          </div>
        </>
      )}
    </>
  );
}
