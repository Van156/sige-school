import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Layers, Plus } from "lucide-react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";

import { useCanManage } from "../hooks/use-can-manage";
import { useDeleteEntity } from "../hooks/use-delete-entity";
import type { LevelRow } from "../types";
import ActiveInstitutionBanner from "./active-institution-banner";
import ActiveInstitutionGuard from "./active-institution-guard";
import ConfirmDelete from "./confirm-delete";
import LevelsTable from "./levels-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar los niveles académicos.";

/** INS-09 `/niveles` (container): levels of the active institution, read-only without `level:create`. */
export default function LevelsPage() {
  return (
    <ActiveInstitutionGuard pageName="sus niveles académicos">
      <LevelsContent />
    </ActiveInstitutionGuard>
  );
}

function LevelsContent() {
  const canManage = useCanManage("level");
  const levelsQuery = useQuery(orpc.level.list.queryOptions({ input: {} }));
  const deleteLevel = useMutation(orpc.level.delete.mutationOptions());
  const deletion = useDeleteEntity<LevelRow>({
    remove: (level) => deleteLevel.mutateAsync({ id: level.id }),
    invalidate: orpc.level.key(),
    successMessage: () => "Nivel eliminado",
  });

  const levels = levelsQuery.data;
  const createLink = (label: string) => (
    <Link to="/niveles/nuevo" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Niveles Académicos"
        description="Gestiona los niveles académicos (Primero, Sexto, Once, etc.) por sede"
        actions={canManage ? createLink("Nuevo Nivel") : undefined}
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid>
            <StatTile label="Niveles Registrados" value={levels?.length ?? 0} icon={Layers} />
          </StatGrid>
        }
        listTitle="Listado de Niveles"
      >
        {levelsQuery.isPending ? (
          <Loader />
        ) : levelsQuery.isError ? (
          <LoadError message={LOAD_ERROR_MESSAGE} onRetry={() => void levelsQuery.refetch()} />
        ) : levels?.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No hay niveles académicos"
            description={`Crea niveles como "Primero", "Sexto", "Once" para agrupar tus cursos.`}
            action={canManage ? createLink("Crear Primer Nivel") : undefined}
          />
        ) : (
          <LevelsTable
            levels={levels ?? []}
            canManage={canManage}
            isPending={false}
            errorMessage={null}
            onRetry={() => void levelsQuery.refetch()}
            onDelete={deletion.requestDelete}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title={`¿Eliminar el nivel ${deletion.target?.name ?? ""}?`}
        description="Esta acción no se puede deshacer si tiene cursos asociados."
      />
    </>
  );
}
