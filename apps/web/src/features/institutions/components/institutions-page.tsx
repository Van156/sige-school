import { buttonVariants } from "@base-template/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import PageHeader from "@/shared/components/layout/page-header";

import InstitutionsTable from "./institutions-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar las instituciones.";

/**
 * INS-01 `/admin/instituciones` (container, root only): lists every institution with its rector
 * (`institutionAdmin.list`) and links to the creation form. The admin layout owns the
 * superadmin guard; the procedure re-checks.
 */
export default function InstitutionsPage() {
  const institutionsQuery = useQuery(orpc.institutionAdmin.list.queryOptions());
  const institutions = institutionsQuery.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestión de Instituciones"
        description="Administra todas las instituciones educativas del sistema"
        actions={
          <Link to="/admin/instituciones/nueva" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Nueva Institución
          </Link>
        }
      />
      {institutionsQuery.isPending ? (
        <Loader />
      ) : institutions?.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No hay instituciones creadas"
          description="Comienza creando la primera institución educativa del sistema."
          action={
            <Link to="/admin/instituciones/nueva" className={buttonVariants()}>
              Crear Primera Institución
            </Link>
          }
        />
      ) : (
        <InstitutionsTable
          institutions={institutions ?? []}
          isPending={false}
          errorMessage={institutionsQuery.isError ? LOAD_ERROR_MESSAGE : null}
          onRetry={() => void institutionsQuery.refetch()}
        />
      )}
    </div>
  );
}
