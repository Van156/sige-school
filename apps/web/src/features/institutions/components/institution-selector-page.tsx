import { buttonVariants } from "@base-template/ui/components/button";
import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, LayoutDashboard, List, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useManageInstitution } from "../hooks/use-manage-institution";
import InstitutionSelector from "./institution-selector";

/** The API's largest page; the selector lists every institution on one screen. */
const SELECTOR_PAGE_SIZE = 100;

/**
 * INS-03 `/admin/instituciones/seleccionar` (container, root only): pick the institution to work
 * in. "Seleccionar y Continuar" calls `institutionAdmin.manage`, starts the impersonation and
 * opens the dashboard of that institution.
 */
export default function InstitutionSelectorPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listQuery = useQuery(
    orpc.institutionAdmin.list.queryOptions({
      input: { perPage: SELECTOR_PAGE_SIZE, sort: [{ id: "name", desc: false }] },
    }),
  );
  const manage = useManageInstitution("/dashboard");
  const institutions = listQuery.data?.rows;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Seleccionar Institución"
        description="Como administrador del sistema, seleccione la institución donde desea trabajar"
        actions={
          <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Volver al Dashboard
          </Link>
        }
      />
      <Alert>
        <Building2 />
        <AlertDescription>
          <strong>Importante:</strong> Debe seleccionar una institución para gestionar sedes, grados
          y otros elementos. Esta selección determina el contexto de trabajo.
        </AlertDescription>
      </Alert>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Instituciones Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isPending ? (
            <Loader />
          ) : listQuery.isError || institutions === undefined ? (
            <LoadError
              message="No se pudieron cargar las instituciones."
              onRetry={() => void listQuery.refetch()}
            />
          ) : institutions.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="No hay instituciones creadas"
              description="Comienza creando tu primera institución educativa del sistema."
              action={
                <Link to="/admin/instituciones/nueva" className={buttonVariants()}>
                  Crear Primera Institución
                </Link>
              }
            />
          ) : (
            <InstitutionSelector
              institutions={institutions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSubmit={() => selectedId && manage.manage(selectedId)}
              isSubmitting={manage.isPending}
            />
          )}
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <ShortcutCard to="/admin/instituciones" icon={<List />} label="Lista Completa" />
        <ShortcutCard to="/admin/instituciones/nueva" icon={<Plus />} label="Nueva Institución" />
        <ShortcutCard to="/dashboard" icon={<LayoutDashboard />} label="Dashboard Root" />
      </div>
    </div>
  );
}

function ShortcutCard({
  to,
  icon,
  label,
}: {
  to: "/admin/instituciones" | "/admin/instituciones/nueva" | "/dashboard";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link to={to} className={buttonVariants({ variant: "outline" })}>
      {icon}
      {label}
    </Link>
  );
}
