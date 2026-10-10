import { buttonVariants } from "@base-template/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserX } from "lucide-react";
import type { ReactNode } from "react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import type { StudentDetail } from "../types";

/**
 * Loads `student.get` for the per-student pages (STU-02, STU-04) and renders `children` with it;
 * an unknown or out-of-scope id (NOT_FOUND, R1.15) shows "Estudiante no encontrado", any other
 * failure a retryable error. Container.
 */
export default function StudentDetailLoader({
  studentId,
  children,
}: {
  studentId: string;
  children: (student: StudentDetail) => ReactNode;
}) {
  const detailQuery = useQuery(orpc.student.get.queryOptions({ input: { id: studentId } }));

  if (detailQuery.isPending) {
    return <Loader />;
  }
  if (detailQuery.isError && detailQuery.data === undefined) {
    return isNotFoundError(detailQuery.error) ? (
      <EmptyState
        icon={<UserX />}
        title="Estudiante no encontrado"
        description="El estudiante no existe o no tienes acceso a su perfil."
        action={
          <Link to="/estudiantes" className={buttonVariants()}>
            Volver a Estudiantes
          </Link>
        }
      />
    ) : (
      <LoadError
        message="No se pudo cargar el estudiante."
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }
  return children(detailQuery.data);
}
