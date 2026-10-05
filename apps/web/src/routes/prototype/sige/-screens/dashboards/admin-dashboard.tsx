import {
  BookOpen,
  Building2,
  CalendarRange,
  ChartColumn,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  MapPin,
  NotebookPen,
  School,
} from "lucide-react";

import { ActionLink } from "../../-components/action-link";
import { CategoryBarChart } from "../../-components/charts";
import { InstitutionBanner } from "../../-components/institution-banner";
import { ScreenLinkButton } from "../../-components/link-button";
import { SigePageHeader } from "../../-components/page-header";
import { SectionCard } from "../../-components/section-card";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { formatScore } from "../../-lib/format";
import {
  groupPerformanceOf,
  levelDistribution,
  referencePeriod,
  schoolCounts,
} from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import { INSTITUTION_ID } from "../../-mock";

const LEVEL_COLORS = {
  Superior: "var(--success)",
  Alto: "var(--info)",
  Básico: "var(--warning)",
  Bajo: "var(--destructive)",
} as const;

/** DASH-02: institution KPIs, quick actions, configuration links and academic snapshot. */
export function AdminDashboard() {
  const metrics = useMetrics(INSTITUTION_ID);
  const counts = schoolCounts(metrics);
  const period = referencePeriod(metrics);
  const groups = groupPerformanceOf(metrics, period);
  const distribution = levelDistribution(metrics, period);

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader
        title="Dashboard Administrador"
        description="Gestión integral de tu institución educativa"
      />
      <InstitutionBanner badge="Tu Institución" />

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
              Gestionar Estudiantes
            </ScreenLinkButton>
            <ScreenLinkButton screenId="SCH-01">
              <CalendarRange />
              Matrícula y Programación
            </ScreenLinkButton>
            <ScreenLinkButton screenId="GRD-01">
              <NotebookPen />
              Ingresar Notas
            </ScreenLinkButton>
            <ScreenLinkButton screenId="RPT-01">
              <FileText />
              Generar Boletines
            </ScreenLinkButton>
            <ScreenLinkButton screenId="MET-01">
              <ChartColumn />
              Ver Métricas
            </ScreenLinkButton>
          </div>
        </SectionCard>

        <SectionCard title="Configuración del Sistema">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionLink
              screenId="INS-06"
              icon={Building2}
              title="Datos Institución"
              subtitle="Nombre, NIT, contacto"
            />
            <ActionLink
              screenId="INS-07"
              icon={MapPin}
              title="Gestión de Sedes"
              subtitle="Crear y editar sedes"
            />
            <ActionLink
              screenId="INS-11"
              icon={Layers}
              title="Gestión de Grados"
              subtitle="Grados y grupos"
            />
            <ActionLink
              screenId="INS-13"
              icon={BookOpen}
              title="Asignaturas"
              subtitle="Materias y códigos"
            />
            <ActionLink
              screenId="INS-15"
              icon={CalendarRange}
              title="Periodos Académicos"
              subtitle="Periodos y fechas"
            />
            <ActionLink
              screenId="INS-17"
              icon={ListChecks}
              title="Criterios Evaluación"
              subtitle="Ponderación de notas"
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Promedio por grupo"
          description={`${period?.name ?? "Sin periodo"}, escala 1.0 a 5.0`}
        >
          <CategoryBarChart
            ariaLabel="Promedio de notas por grupo en el último periodo cerrado"
            seriesLabel="Promedio"
            domain={[0, 5]}
            valueFormatter={(value) => formatScore(value, 1)}
            data={groups.map((group) => ({ label: group.group, value: group.average }))}
          />
        </SectionCard>
        <SectionCard
          title="Niveles de desempeño"
          description={`Notas finales de ${period?.name ?? "ningún periodo"}`}
        >
          <CategoryBarChart
            ariaLabel="Cantidad de notas finales por nivel de desempeño"
            seriesLabel="Notas"
            data={distribution.map((item) => ({
              label: item.level,
              value: item.count,
              color: LEVEL_COLORS[item.level],
            }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
