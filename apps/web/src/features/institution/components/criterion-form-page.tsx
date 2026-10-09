import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import {
  criterionToFormValues,
  criterionUpdatedMessage,
  emptyCriterionForm,
  nextCriterionOrder,
  totalWithCriterion,
  type CriterionFormValues,
  type CriterionInput,
} from "../lib/criterion-form";
import { INVALID_FORM_MESSAGE } from "../lib/form-messages";
import type { CriterionRow } from "../types";
import ActiveInstitutionGuard from "./active-institution-guard";
import CriterionForm from "./criterion-form";
import CriterionWeightHelp from "./criterion-weight-help";
import FormPageLayout from "./form-page-layout";

const BREADCRUMB_ROOT = { label: "Criterios de Evaluación", to: "/criterios" } as const;

/**
 * INS-18 `/criterios/nuevo` and `/criterios/$id/editar` (container): create when `criterionId` is
 * omitted, else edit. Forms are unreachable without the mutation permission (INS-R1).
 */
export default function CriterionFormPage({ criterionId }: { criterionId?: string }) {
  const title = criterionId === undefined ? "Nuevo Criterio" : "Editar Criterio";
  return (
    <ActiveInstitutionGuard pageName="sus criterios de evaluación">
      <CanGate
        permission={criterionId === undefined ? "criterion:create" : "criterion:update"}
        message="No tienes permiso para gestionar los criterios de evaluación de esta institución."
      >
        <PageHeader
          title={title}
          description="Define cómo se calculan las notas de cada periodo"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        <CriterionFormLoader criterionId={criterionId} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

/** Loads the list (for the live total and the default order) and, on edit, the criterion. */
function CriterionFormLoader({ criterionId }: { criterionId?: string }) {
  const listQuery = useQuery(orpc.criterion.list.queryOptions());
  const criterionQuery = useQuery({
    ...orpc.criterion.get.queryOptions({ input: { id: criterionId ?? "" } }),
    enabled: criterionId !== undefined,
  });

  if (listQuery.isPending || (criterionId !== undefined && criterionQuery.isPending)) {
    return <Loader />;
  }
  if (criterionQuery.isError) {
    return (criterionQuery.error as { code?: unknown }).code === "NOT_FOUND" ? (
      <EmptyState
        icon={<ListChecks />}
        title="Criterio no encontrado"
        description="El criterio no existe o ya fue eliminado."
        action={
          <Link to="/criterios" className={buttonVariants()}>
            Volver a Criterios
          </Link>
        }
      />
    ) : (
      <LoadError
        message="No se pudo cargar el criterio."
        onRetry={() => void criterionQuery.refetch()}
      />
    );
  }
  if (listQuery.isError) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => void listQuery.refetch()}
      />
    );
  }
  const rows = listQuery.data.rows;
  return criterionId === undefined ? (
    <CriterionFormSection
      mode="create"
      rows={rows}
      initialValues={emptyCriterionForm(nextCriterionOrder(rows))}
    />
  ) : criterionQuery.data ? (
    <CriterionFormSection
      mode="edit"
      rows={rows}
      criterion={criterionQuery.data}
      initialValues={criterionToFormValues(criterionQuery.data)}
    />
  ) : null;
}

function CriterionFormSection({
  mode,
  rows,
  criterion,
  initialValues,
}: {
  mode: "create" | "edit";
  rows: readonly CriterionRow[];
  criterion?: CriterionRow;
  initialValues: CriterionFormValues;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createMutation = useMutation(orpc.criterion.create.mutationOptions());
  const updateMutation = useMutation(orpc.criterion.update.mutationOptions());
  const [weightDraft, setWeightDraft] = useState(initialValues.weight);

  async function save(input: CriterionInput) {
    let message = "Criterio creado";
    if (criterion) {
      const updated = await updateMutation.mutateAsync({ id: criterion.id, ...input });
      message = criterionUpdatedMessage(updated.affectedFinals);
    } else {
      await createMutation.mutateAsync(input);
    }
    toast.success(message);
    await queryClient.invalidateQueries({ queryKey: orpc.criterion.key() });
    await navigate({ to: "/criterios" });
  }

  return (
    <FormPageLayout
      form={
        <CriterionForm
          mode={mode}
          initialValues={initialValues}
          onSubmit={save}
          onWeightChange={setWeightDraft}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
        />
      }
      help={
        <CriterionWeightHelp total={totalWithCriterion(rows, criterion?.id ?? null, weightDraft)} />
      }
    />
  );
}
