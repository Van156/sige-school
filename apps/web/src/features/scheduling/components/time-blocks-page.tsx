import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, Coffee, Layers, Plus } from "lucide-react";

import { orpc } from "@/app/orpc";
import { useCan } from "@/features/access-control";
import {
  ActiveInstitutionBanner,
  ActiveInstitutionGuard,
  ConfirmDelete,
  useDeleteEntity,
} from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";

import { SCHEDULING_ACTIONS } from "../lib/action-permissions";
import { timeBlockStats } from "../lib/time-block-list";
import type { TimeBlockRow } from "../types";
import TimeBlocksTable from "./time-blocks-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar los bloques de tiempo.";

/**
 * SCH-09 `/bloques` (container): time blocks of the active institution. "Nuevo Bloque", edit and
 * delete each show only with their own permission (`SCHEDULING_ACTIONS.timeBlocks`).
 */
export default function TimeBlocksPage() {
  return (
    <ActiveInstitutionGuard pageName="sus bloques de tiempo">
      <TimeBlocksContent />
    </ActiveInstitutionGuard>
  );
}

function TimeBlocksContent() {
  const canCreate = useCan(SCHEDULING_ACTIONS.timeBlocks.create).can;
  const canEdit = useCan(SCHEDULING_ACTIONS.timeBlocks.edit).can;
  const canDelete = useCan(SCHEDULING_ACTIONS.timeBlocks.delete).can;
  const blocksQuery = useQuery(orpc.timeBlock.list.queryOptions({ input: {} }));
  const deleteBlock = useMutation(orpc.timeBlock.delete.mutationOptions());
  const deletion = useDeleteEntity<TimeBlockRow>({
    remove: (block) => deleteBlock.mutateAsync({ id: block.id }),
    invalidate: orpc.timeBlock.key(),
    successMessage: () => "Bloque eliminado",
  });

  const blocks = blocksQuery.data;
  const stats = timeBlockStats(blocks ?? []);
  const createLink = (label: string) => (
    <Link to="/bloques/nuevo" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Bloques de Tiempo"
        description="Definición de bloques horarios para generación de horarios"
        actions={canCreate ? createLink("Nuevo Bloque") : undefined}
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid columns={3}>
            <StatTile label="Total Bloques" value={stats.total} icon={Layers} />
            <StatTile label="Bloques de Clase" value={stats.classes} icon={Clock} />
            <StatTile label="Descansos" value={stats.breaks} icon={Coffee} />
          </StatGrid>
        }
        listTitle="Bloques de Tiempo"
      >
        {blocksQuery.isPending ? (
          <Loader />
        ) : blocksQuery.isError ? (
          <LoadError message={LOAD_ERROR_MESSAGE} onRetry={() => void blocksQuery.refetch()} />
        ) : blocks?.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No hay bloques de tiempo definidos"
            description="Defina los bloques horarios para cada sede"
            action={canCreate ? createLink("Crear Bloque") : undefined}
          />
        ) : (
          <TimeBlocksTable
            blocks={blocks ?? []}
            canEdit={canEdit}
            canDelete={canDelete}
            isPending={false}
            errorMessage={null}
            onRetry={() => void blocksQuery.refetch()}
            onDelete={deletion.requestDelete}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title="¿Eliminar este bloque?"
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}
