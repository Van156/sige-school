import { Badge } from "@base-template/ui/components/badge";
import { Card } from "@base-template/ui/components/card";
import {
  Building2,
  GraduationCap,
  Plus,
  School,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";

import { ActionLink } from "../../-components/action-link";
import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { SigePageHeader } from "../../-components/page-header";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { globalCounts, institutionSummaries, institutions } from "../../-mock";
import type { Institution, InstitutionSummary } from "../../-mock/types";

/** DASH-01: global KPIs, one card per institution and quick access. */
export function RootDashboard() {
  const totals = globalCounts();
  const summaries = new Map(institutionSummaries().map((item) => [item.institutionId, item]));

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader
        title="Panel de Administración General"
        description="Gestión centralizada de todas las instituciones educativas"
        actions={
          <ScreenLinkButton screenId="INS-02" variant="default">
            <Plus />
            Nueva Institución
          </ScreenLinkButton>
        }
      />

      <StatGrid columns={5}>
        <StatTile label="Instituciones" value={totals.institutions} icon={Building2} />
        <StatTile label="Usuarios" value={totals.users.toLocaleString("es-CO")} icon={UsersRound} />
        <StatTile
          label="Estudiantes"
          value={totals.students.toLocaleString("es-CO")}
          icon={GraduationCap}
        />
        <StatTile label="Profesores" value={totals.teachers} icon={School} />
        <StatTile label="Admins" value={totals.admins} icon={ShieldCheck} />
      </StatGrid>

      <section className="flex flex-col gap-3" aria-labelledby="registered-institutions">
        <h2 id="registered-institutions" className="text-base font-semibold">
          Instituciones Registradas
        </h2>
        {institutions.length === 0 ? (
          <EmptyBlock
            icon={<Building2 />}
            title="No hay instituciones creadas"
            description="Comience creando la primera institución educativa del sistema."
            action={
              <ScreenLinkButton screenId="INS-02" variant="default">
                Crear Primera Institución
              </ScreenLinkButton>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {institutions.map((institution) => (
              <InstitutionCard
                key={institution.id}
                institution={institution}
                summary={summaries.get(institution.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="quick-access">
        <h2 id="quick-access" className="text-base font-semibold">
          Accesos Rápidos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ActionLink
            screenId="USR-01"
            icon={Users}
            title="Gestionar Usuarios"
            subtitle="Crear, editar y eliminar usuarios"
          />
          <ActionLink
            screenId="INS-01"
            icon={Building2}
            title="Lista Instituciones"
            subtitle="Ver todas las instituciones"
          />
          <ActionLink
            screenId="USR-01"
            icon={ShieldCheck}
            title="Ver Admins"
            subtitle="Gestionar administradores"
            search={{ rol: "admin" }}
          />
          <ActionLink
            screenId="INS-03"
            icon={School}
            title="Cambiar Institución"
            subtitle="Alternar contexto activo"
          />
        </div>
      </section>
    </div>
  );
}

const SEGMENTS = [
  { key: "students", label: "Estudiantes", color: "bg-chart-1" },
  { key: "teachers", label: "Profesores", color: "bg-chart-2" },
  { key: "admins", label: "Admins", color: "bg-chart-3" },
] as const;

function InstitutionCard({
  institution,
  summary,
}: {
  institution: Institution;
  summary: InstitutionSummary | undefined;
}) {
  const counts = summary ?? {
    admins: 0,
    campuses: 0,
    teachers: 0,
    students: 0,
    users: 0,
    institutionId: institution.id,
  };
  const total = counts.students + counts.teachers + counts.admins;

  return (
    <Card size="sm" className="gap-4">
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="truncate text-base font-semibold">{institution.name}</h3>
            <span className="text-[13px] text-muted-foreground">NIT: {institution.nit}</span>
            <span className="text-[13px] text-muted-foreground">
              {institution.municipality}, {institution.department}
            </span>
          </div>
          <Badge variant="secondary">{institution.academicYear}</Badge>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Distribución de Usuarios</span>
          {total === 0 ? (
            <span className="text-[13px] text-muted-foreground">Sin usuarios registrados aún</span>
          ) : (
            <>
              <div
                className="flex h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={SEGMENTS.map(
                  (segment) =>
                    `${segment.label} ${Math.round((counts[segment.key] / total) * 100)}%`,
                ).join(", ")}
              >
                {SEGMENTS.map((segment) => (
                  <span
                    key={segment.key}
                    className={segment.color}
                    style={{ width: `${(counts[segment.key] / total) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {SEGMENTS.map((segment) => (
                  <li key={segment.key} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${segment.color}`} aria-hidden="true" />
                    {segment.label} {Math.round((counts[segment.key] / total) * 100)}%
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <dl className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Admins", counts.admins],
            ["Sedes", counts.campuses],
            ["Profesores", counts.teachers],
            ["Estudiantes", counts.students],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col rounded-md bg-muted/50 px-1 py-1.5">
              <dd className="text-sm font-semibold tabular-nums">{value}</dd>
              <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          <ScreenLinkButton screenId="INS-04" size="sm">
            Usuarios
          </ScreenLinkButton>
          <ScreenLinkButton screenId="INS-02" size="sm">
            Editar
          </ScreenLinkButton>
          <ScreenLinkButton screenId="INS-07" size="sm">
            Gestionar Sedes
          </ScreenLinkButton>
        </div>
      </div>
    </Card>
  );
}
