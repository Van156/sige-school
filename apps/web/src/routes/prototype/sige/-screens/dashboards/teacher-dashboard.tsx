import {
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Layers,
  NotebookPen,
  CalendarCheck,
  OctagonAlert,
  TriangleAlert,
  BookOpen,
  Sparkles,
} from "lucide-react";

import { Badge } from "@base-template/ui/components/badge";
import { cn } from "@base-template/ui/lib/utils";

import { CategoryBarChart } from "../../-components/charts";
import { Callout } from "../../-components/callout";
import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { SigePageHeader } from "../../-components/page-header";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { formatScore } from "../../-lib/format";
import { useRole } from "../../-lib/use-role";
import {
  currentUserFor,
  fullName,
  gradeById,
  studentCountOfGrade,
  subjectById,
  teacherAnalytics,
  teacherSubjectGrades,
  teacherSuggestions,
  type TeacherGroupState,
} from "../../-mock";

type AnalyticsRow = ReturnType<typeof teacherAnalytics>[number];

const STATE_COPY: Record<
  TeacherGroupState,
  { label: string; icon: typeof CheckCircle2; className: string; color: string }
> = {
  risk: {
    label: "Riesgo Alto",
    icon: OctagonAlert,
    className: "text-destructive",
    color: "var(--destructive)",
  },
  attention: {
    label: "Atención Necesaria",
    icon: TriangleAlert,
    className: "text-foreground",
    color: "var(--warning)",
  },
  optimal: {
    label: "Óptimo",
    icon: CheckCircle2,
    className: "text-success",
    color: "var(--success)",
  },
};

function RateBar({ rate }: { rate: number }) {
  const tone = rate > 30 ? "bg-destructive" : rate > 15 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Tasa de reprobación"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="w-9 text-right tabular-nums">{rate}%</span>
    </div>
  );
}

/** DASH-04: own groups, longitudinal analytics, rule-based suggestions and class shortcuts. */
export function TeacherDashboard() {
  const role = useRole();
  const user = currentUserFor(role);
  const assignments = teacherSubjectGrades(user.id);
  const analytics = teacherAnalytics(user.id);
  const suggestions = teacherSuggestions(user.id);
  const groupIds = [...new Set(assignments.map((item) => item.gradeId))];
  const studentsInCharge = groupIds.reduce((sum, gradeId) => sum + studentCountOfGrade(gradeId), 0);

  const analyticsColumns: TableColumn<AnalyticsRow>[] = [
    {
      key: "subject",
      header: "Materia / Grado",
      cell: (row) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{row.subjectName}</span>
          <span className="text-xs text-muted-foreground">{row.gradeName}</span>
        </div>
      ),
    },
    {
      key: "shift",
      header: "Jornada",
      cell: (row) => <Badge variant="outline">{row.shift}</Badge>,
    },
    { key: "average", header: "Promedio", align: "right", cell: (row) => formatScore(row.average) },
    { key: "failing", header: "Reprobación", cell: (row) => <RateBar rate={row.failingRate} /> },
    {
      key: "state",
      header: "Estado",
      cell: (row) => {
        const state = STATE_COPY[row.state];
        const Icon = state.icon;
        return (
          <span className={cn("inline-flex items-center gap-1.5", state.className)}>
            <Icon className="size-4" />
            {state.label}
          </span>
        );
      },
    },
  ];

  const classColumns: TableColumn<(typeof assignments)[number]>[] = [
    {
      key: "subject",
      header: "Asignatura",
      cell: (item) => {
        const subject = subjectById.get(item.subjectId);
        return (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{subject?.name}</span>
            <span className="text-xs text-muted-foreground">{subject?.code}</span>
          </div>
        );
      },
    },
    {
      key: "grade",
      header: "Grado",
      cell: (item) => <Badge variant="secondary">{gradeById.get(item.gradeId)?.name}</Badge>,
    },
    {
      key: "actions",
      header: "Acciones",
      cell: () => (
        <div className="flex flex-wrap gap-1.5">
          <ScreenLinkButton screenId="GRD-02" size="sm">
            <NotebookPen />
            Notas
          </ScreenLinkButton>
          <ScreenLinkButton screenId="ATT-01" size="sm">
            <CalendarCheck />
            Asistencia
          </ScreenLinkButton>
          <ScreenLinkButton screenId="OBS-03" size="sm">
            <ClipboardList />
            Observaciones
          </ScreenLinkButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader title="Dashboard Profesor" description={`Bienvenido/a, ${fullName(user)}`} />

      <StatGrid columns={3}>
        <StatTile label="Asignaturas" value={assignments.length} icon={BookOpen} />
        <StatTile label="Estudiantes a Cargo" value={studentsInCharge} icon={GraduationCap} />
        <StatTile label="Grados" value={groupIds.length} icon={Layers} />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Analítica de Desempeño"
          description="Longitudinal por materia: promedio P1-P3 y reprobación del tercer periodo"
          className="xl:col-span-2"
          action={<Badge variant="secondary">Longitudinal por Materia</Badge>}
        >
          {analytics.length === 0 ? (
            <EmptyBlock
              title="Sin datos de desempeño"
              description="Aún no hay notas finales registradas."
            />
          ) : (
            <SimpleTable
              columns={analyticsColumns}
              rows={analytics}
              getRowId={(row) => row.subjectGradeId}
            />
          )}
        </SectionCard>

        <SectionCard title="Sugerencias IA" description="Basadas en reglas sobre tus grupos">
          {suggestions.length === 0 ? (
            <EmptyBlock
              icon={<Sparkles />}
              title="¡Excelente trabajo!"
              description="No se detectan anomalías críticas en el rendimiento de tus grupos."
            />
          ) : (
            suggestions.map((suggestion) => (
              <Callout
                key={suggestion.id}
                tone={suggestion.tone === "danger" ? "destructive" : "warning"}
                title={suggestion.title}
              >
                <p>{suggestion.message}</p>
                <p className="mt-1">
                  <strong className="font-medium text-foreground">Sugerencia:</strong>{" "}
                  {suggestion.action}
                </p>
              </Callout>
            ))
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Promedio por clase" description="Color según el estado de la clase">
          <CategoryBarChart
            ariaLabel="Promedio de notas por clase"
            seriesLabel="Promedio"
            domain={[0, 5]}
            valueFormatter={(value) => formatScore(value, 1)}
            className="aspect-[16/10] w-full"
            data={analytics.map((row) => ({
              label: `${row.subjectCode} ${row.gradeName}`,
              value: row.average,
              color: STATE_COPY[row.state].color,
            }))}
          />
        </SectionCard>

        <SectionCard title="Gestión de Clases" className="xl:col-span-2">
          {assignments.length === 0 ? (
            <EmptyBlock
              title="No tienes asignaturas asignadas aún"
              description="Contacta al administrador para que te asigne materias y grados."
            />
          ) : (
            <SimpleTable columns={classColumns} rows={assignments} getRowId={(item) => item.id} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
