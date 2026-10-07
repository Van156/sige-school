import { Badge } from "@base-template/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import PageHeader from "@/shared/components/layout/page-header";

import type { DashboardLink } from "../lib/dashboard-links";

const KPI_LABELS = ["Estudiantes", "Profesores", "Grados", "Asignaturas"] as const;

function KpiTile({ label }: { label: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        {/* No data procedure yet: an honest dash, never a placeholder number. */}
        <CardTitle className="text-2xl" aria-label={`${label}: sin datos`}>
          —
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function LinkGrid({ links, emptyTitle }: { links: readonly DashboardLink[]; emptyTitle: string }) {
  if (links.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description="Aparecerán aquí a medida que se habiliten los módulos."
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <li key={link.label}>
          <Link
            to={link.to}
            className="flex h-full flex-col gap-1 rounded-lg border p-3 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="font-medium">{link.label}</span>
            <span className="text-xs text-muted-foreground">{link.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * DASH-02 "Dashboard Administrador" (sige/01 §5.3). Widgets whose data procedures do not exist yet
 * render empty states; link blocks list only the entries whose screen exists.
 */
export default function ManagementDashboard({
  institutionName,
  impersonating,
  quickActions,
  systemLinks,
}: {
  institutionName?: string | null;
  /** A root admin viewing the institution: the banner badge reads "Vista Root". */
  impersonating: boolean;
  quickActions: readonly DashboardLink[];
  systemLinks: readonly DashboardLink[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Administrador"
        description="Gestión integral de tu institución educativa"
        actions={
          <>
            {institutionName ? (
              <span className="text-sm font-medium">{institutionName}</span>
            ) : null}
            <Badge variant={impersonating ? "default" : "success"}>
              {impersonating ? "Vista Root" : "Tu Institución"}
            </Badge>
          </>
        }
      />
      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_LABELS.map((label) => (
          <KpiTile key={label} label={label} />
        ))}
      </section>
      <Section title="Acciones Rápidas">
        <LinkGrid links={quickActions} emptyTitle="Sin acciones disponibles" />
      </Section>
      <Section title="Configuración del Sistema">
        <LinkGrid links={systemLinks} emptyTitle="Sin configuraciones disponibles" />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Promedio por grupo" description="Sin periodo, escala 1.0 a 5.0">
          <EmptyState title="Sin datos" description="Aún no hay notas registradas." />
        </Section>
        <Section title="Niveles de desempeño" description="Notas finales">
          <EmptyState title="Sin datos" description="Aún no hay notas registradas." />
        </Section>
      </div>
    </div>
  );
}
