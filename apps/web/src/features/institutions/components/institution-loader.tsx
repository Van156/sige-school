import { buttonVariants } from "@base-template/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import type { ReactNode } from "react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import type { InstitutionDetail } from "../types";

/**
 * Container: loads the institution `institutionId` (`institutionAdmin.get`) for a platform screen
 * about it (INS-04/05) and renders `children` with it. A bad id shows the not-found state, any
 * other failure a retry. A failed background refetch keeps the cached institution on screen.
 */
export default function InstitutionLoader({
  institutionId,
  children,
}: {
  institutionId: string;
  children: (institution: InstitutionDetail) => ReactNode;
}) {
  const query = useQuery(orpc.institutionAdmin.get.queryOptions({ input: { id: institutionId } }));

  if (query.isPending) {
    return <Loader />;
  }
  if (query.data === undefined) {
    return isNotFoundError(query.error) ? (
      <EmptyState
        icon={<Building2 />}
        title="Institución no encontrada"
        description="La institución no existe o ya fue eliminada."
        action={
          <Link to="/admin/instituciones" className={buttonVariants()}>
            Volver a Instituciones
          </Link>
        }
      />
    ) : (
      <LoadError message="No se pudo cargar la institución." onRetry={() => void query.refetch()} />
    );
  }
  return <>{children(query.data)}</>;
}
