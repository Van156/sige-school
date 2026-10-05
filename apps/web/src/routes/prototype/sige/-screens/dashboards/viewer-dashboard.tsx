import { BookOpen, GraduationCap, Layers, School } from "lucide-react";

import { Callout } from "../../-components/callout";
import { CategoryBarChart } from "../../-components/charts";
import { InstitutionBanner } from "../../-components/institution-banner";
import { SigePageHeader } from "../../-components/page-header";
import { SectionCard } from "../../-components/section-card";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { formatPercent } from "../../-lib/format";
import { useRole } from "../../-lib/use-role";
import { groupPerformanceOf, referencePeriod, schoolCounts } from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import { INSTITUTION_ID, currentUserFor, fullName } from "../../-mock";

/** DASH-07: read-only institution KPIs. */
export function ViewerDashboard() {
  const role = useRole();
  const user = currentUserFor(role);
  const metrics = useMetrics(INSTITUTION_ID);
  const counts = schoolCounts(metrics);
  const period = referencePeriod(metrics);
  const groups = groupPerformanceOf(metrics, period);

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader
        title="Dashboard de Consulta"
        description={`Bienvenido/a, ${fullName(user)} - Modo solo lectura`}
      />
      <InstitutionBanner badge="Solo lectura" />

      <StatGrid>
        <StatTile label="Estudiantes" value={counts.students} icon={GraduationCap} />
        <StatTile label="Profesores" value={counts.teachers} icon={School} />
        <StatTile label="Grados" value={counts.grades} icon={Layers} />
        <StatTile label="Asignaturas" value={counts.subjects} icon={BookOpen} />
      </StatGrid>

      <Callout tone="info" title="Modo Solo Lectura">
        Tienes acceso de consulta a la información del sistema. Contacta al administrador si
        necesitas permisos adicionales.
      </Callout>

      <SectionCard
        title="Aprobación por grupo"
        description={`Porcentaje de asignaturas ganadas en ${period?.name ?? "el último periodo"}`}
      >
        <CategoryBarChart
          ariaLabel="Porcentaje de aprobación por grupo en el último periodo cerrado"
          seriesLabel="Aprobación"
          domain={[0, 100]}
          valueFormatter={(value) => formatPercent(value)}
          data={groups.map((group) => ({ label: group.group, value: group.passRate }))}
        />
      </SectionCard>
    </div>
  );
}
