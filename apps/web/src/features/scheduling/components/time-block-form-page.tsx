import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
  campusChoices,
  FormPageLayout,
  INVALID_FORM_MESSAGE,
} from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import { useSaveAndReturn } from "../hooks/use-save-and-return";
import { SCHEDULING_ACTIONS } from "../lib/action-permissions";
import {
  emptyTimeBlockForm,
  timeBlockToFormValues,
  type TimeBlockInput,
} from "../lib/time-block-form";
import TimeBlockForm from "./time-block-form";
import TypicalBlocksHelp from "./typical-blocks-help";

const BREADCRUMB_ROOT = { label: "Bloques de Tiempo", to: "/bloques" } as const;

/**
 * SCH-10 `/bloques/nuevo` and `/bloques/$id/editar` (container): create when `blockId` is
 * omitted, else edit. Forms are unreachable without the mutation permission (SCH-R1).
 */
export default function TimeBlockFormPage({ blockId }: { blockId?: string }) {
  const title = blockId === undefined ? "Nuevo Bloque de Tiempo" : "Editar Bloque";
  return (
    <ActiveInstitutionGuard pageName="sus bloques de tiempo">
      <CanGate
        permission={
          blockId === undefined
            ? SCHEDULING_ACTIONS.timeBlocks.create
            : SCHEDULING_ACTIONS.timeBlocks.edit
        }
        message="No tienes permiso para gestionar los bloques de tiempo de esta institución."
      >
        <PageHeader
          title={title}
          description="Período de clase o descanso dentro de la jornada"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        <TimeBlockFormLoader blockId={blockId} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function TimeBlockFormLoader({ blockId }: { blockId?: string }) {
  const save = useSaveAndReturn({ invalidate: orpc.timeBlock.key(), to: "/bloques" });
  const isEdit = blockId !== undefined;
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  // Create reads the list to propose the next "Orden"; it is the cache the listing already holds.
  const blocksQuery = useQuery({
    ...orpc.timeBlock.list.queryOptions({ input: {} }),
    enabled: !isEdit,
  });
  const blockQuery = useQuery({
    ...orpc.timeBlock.get.queryOptions({ input: { id: blockId ?? "" } }),
    enabled: isEdit,
  });
  const createMutation = useMutation(orpc.timeBlock.create.mutationOptions());
  const updateMutation = useMutation(orpc.timeBlock.update.mutationOptions());

  if (isEdit && blockQuery.isError && isNotFoundError(blockQuery.error)) {
    return (
      <EmptyState
        icon={<Layers />}
        title="Bloque no encontrado"
        description="El bloque no existe o ya fue eliminado."
        action={
          <Link to="/bloques" className={buttonVariants()}>
            Volver a Bloques de Tiempo
          </Link>
        }
      />
    );
  }
  if (campusesQuery.isError || (isEdit ? blockQuery.isError : blocksQuery.isError)) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => {
          void campusesQuery.refetch();
          void (isEdit ? blockQuery.refetch() : blocksQuery.refetch());
        }}
      />
    );
  }
  if (campusesQuery.isPending || (isEdit ? blockQuery.isPending : blocksQuery.isPending)) {
    return <Loader />;
  }

  const block = isEdit ? blockQuery.data : undefined;
  const existing = blocksQuery.data ?? [];
  return (
    <FormPageLayout
      form={
        <TimeBlockForm
          mode={isEdit ? "edit" : "create"}
          initialValues={block ? timeBlockToFormValues(block) : emptyTimeBlockForm()}
          campuses={campusChoices(campusesQuery.data, block)}
          existing={existing}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          onSubmit={(input: TimeBlockInput) =>
            block
              ? save(
                  () => updateMutation.mutateAsync({ id: block.id, ...input }),
                  "Bloque actualizado",
                )
              : save(() => createMutation.mutateAsync(input), "Bloque creado")
          }
        />
      }
      help={<TypicalBlocksHelp />}
    />
  );
}
