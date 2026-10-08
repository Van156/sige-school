import { Button, buttonVariants } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { orpc } from "@/app/orpc";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import InstitutionDetailView from "./institution-detail-view";

/**
 * INS-01 "Ver datos completos" (container): loads `institutionAdmin.get` for the opened
 * institution (the list row lacks phone, address and resolution). `institutionId` is `null`
 * while closed, which also keeps the query idle.
 */
export default function InstitutionDetailDialog({
  institutionId,
  onClose,
}: {
  institutionId: string | null;
  onClose: () => void;
}) {
  const detailQuery = useQuery({
    ...orpc.institutionAdmin.get.queryOptions({ input: { id: institutionId ?? "" } }),
    enabled: institutionId !== null,
  });

  return (
    <Dialog open={institutionId !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Datos de la Institución</DialogTitle>
          <DialogDescription>Información registrada de la institución educativa.</DialogDescription>
        </DialogHeader>
        {detailQuery.isError ? (
          <LoadError
            message="No se pudieron cargar los datos de la institución."
            onRetry={() => void detailQuery.refetch()}
          />
        ) : detailQuery.data ? (
          <InstitutionDetailView institution={detailQuery.data} />
        ) : (
          <Loader />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {institutionId ? (
            <Link
              to="/admin/instituciones/$institutionId/editar"
              params={{ institutionId }}
              className={buttonVariants()}
            >
              Editar Institución
            </Link>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
