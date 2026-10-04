import { Badge } from "@base-template/ui/components/badge";
import {
  Bell,
  BookOpen,
  CalendarRange,
  ChartColumn,
  ClipboardList,
  GraduationCap,
  Layers,
  ListChecks,
  School,
} from "lucide-react";

import { ActionLink } from "../../-components/action-link";
import { CategoryBarChart } from "../../-components/charts";
import { InstitutionBanner } from "../../-components/institution-banner";
import { ScreenLinkButton } from "../../-components/link-button";
import { SigePageHeader } from "../../-components/page-header";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge } from "../../-components/tone-badge";
import { OBSERVATION_TONE, capitalize, formatDate } from "../../-lib/format";
import { useRole } from "../../-lib/use-role";
import {
  alerts,
  currentUserFor,
  fullName,
  institutionCounts,
  recentObservations,
  studentName,
  userById,
} from "../../-mock";
import type { Observation } from "../../-mock/types";

const SEVERITY_COLOR = {
  Alta: "var(--destructive)",
  Media: "var(--warning)",
  Baja: "var(--success)",
} as const;

/** DASH-03: KPIs (all four populated), quick actions, academic summary, alerts and recent notes. */
export function CoordinatorDashboard() {
  const role = useRole();
  const counts = institutionCounts();
  const open = alerts.filter((alert) => !alert.resolved);
  const bySeverity = (["alta", "media", "baja"] as const).map((severity) => ({
    label: capitalize(severity),
    value: open.filter((alert) => alert.severity === severity).length,
  }));

  const columns: TableColumn<Observation>[] = [
    {
      key: "student",
      header: "Estudiante",
      cell: (row) => <span className="font-medium">{studentName(row.studentId)}</span>,
    },
    {
      key: "type",
      header: "Tipo",
      cell: (row) => (
        <ToneBadge tone={OBSERVATION_TONE[row.type]}>{capitalize(row.type)}</ToneBadge>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      className: "max-w-80 truncate",
      cell: (row) => row.description,
    },
    {
      key: "author",
      header: "Autor",
      cell: (row) => {
        const author = userById.get(row.authorId);
        return author ? fullName(author) : "";
      },
    },
    { key: "date", header: "Fecha", cell: (row) => formatDate(row.date) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader
        title="Dashboard Coordinador"
        description={`Supervisión académica y seguimiento institucional · ${fullName(currentUserFor(role))}`}
      />
      <InstitutionBanner badge="Coordinación" />

      <StatGrid>
        <StatTile label="Estudiantes" value={counts.students} icon={GraduationCap} />
        <StatTile label="Profesores" value={counts.teachers} icon={School} />
        <StatTile label="Grados" value={counts.grades} icon={Layers} />
        <StatTile label="Asignaturas" value={counts.subjects} icon={BookOpen} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Acciones Rápidas">
          <div className="flex flex-wrap gap-2">
            <ScreenLinkButton screenId="STU-01">
              <GraduationCap />
              Ver Estudiantes
            </ScreenLinkButton>
            <ScreenLinkButton screenId="SCH-01">
              <CalendarRange />
              Matrícula y Programación
            </ScreenLinkButton>
            <ScreenLinkButton screenId="OBS-01">
              <ClipboardList />
              Observaciones
            </ScreenLinkButton>
            <ScreenLinkButton screenId="MET-01">
              <ChartColumn />
              Métricas
            </ScreenLinkButton>
            <ScreenLinkButton screenId="ALR-01">
              <Bell />
              Alertas
            </ScreenLinkButton>
          </div>
        </SectionCard>

        <SectionCard title="Resumen Académico">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionLink
              screenId="INS-11"
              icon={Layers}
              title="Grados"
              subtitle="Gestión académica"
            />
            <ActionLink screenId="INS-13" icon={BookOpen} title="Asignaturas" subtitle="Materias" />
            <ActionLink
              screenId="INS-15"
              icon={CalendarRange}
              title="Periodos"
              subtitle="Periodos académicos"
            />
            <ActionLink
              screenId="INS-17"
              icon={ListChecks}
              title="Criterios"
              subtitle="Evaluación"
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Alertas activas"
          description={`${open.length} sin resolver`}
          action={
            <ScreenLinkButton screenId="ALR-01" size="sm">
              Ver alertas
            </ScreenLinkButton>
          }
        >
          <CategoryBarChart
            ariaLabel="Alertas activas por severidad"
            seriesLabel="Alertas"
            className="aspect-[16/10] w-full"
            data={bySeverity.map((item) => ({
              ...item,
              color: SEVERITY_COLOR[item.label as keyof typeof SEVERITY_COLOR],
            }))}
          />
          <div className="flex flex-wrap gap-1.5">
            {open.slice(0, 3).map((alert) => (
              <Badge key={alert.id} variant="outline" className="max-w-full truncate">
                {alert.title}
              </Badge>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Observaciones recientes"
          className="lg:col-span-2"
          action={
            <ScreenLinkButton screenId="OBS-01" size="sm">
              Ver todas
            </ScreenLinkButton>
          }
        >
          <SimpleTable columns={columns} rows={recentObservations(6)} getRowId={(row) => row.id} />
        </SectionCard>
      </div>
    </div>
  );
}
