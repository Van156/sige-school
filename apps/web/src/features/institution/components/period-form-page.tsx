import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { INVALID_FORM_MESSAGE } from "../lib/form-messages";
import {
  emptyPeriodForm,
  periodToFormValues,
  PERIOD_ACTIVATION_FAILED_MESSAGE,
  planPeriodSave,
  runPeriodSave,
  type PeriodSaveOutcome,
  type PeriodFormValues,
  type PeriodInput,
} from "../lib/period-form";
import ActiveInstitutionGuard from "./active-institution-guard";
import FormPageLayout, { HelpCard } from "./form-page-layout";
import PeriodForm from "./period-form";

const BREADCRUMB_ROOT = { label: "Periodos Académicos", to: "/periodos" } as const;

/**
 * INS-16 `/periodos/nuevo` and `/periodos/$id/editar` (container): create when `periodId` is
 * omitted, else edit. Forms are unreachable without the mutation permission (INS-R1).
 */
export default function PeriodFormPage({ periodId }: { periodId?: string }) {
  const title = periodId === undefined ? "Nuevo Periodo" : "Editar Periodo";
  return (
    <ActiveInstitutionGuard pageName="sus periodos académicos">
      <CanGate
        permission={periodId === undefined ? "period:create" : "period:update"}
        message="No tienes permiso para gestionar los periodos académicos de esta institución."
      >
        <PageHeader
          title={title}
          description="División del año lectivo en la que se cierran las notas"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        {periodId === undefined ? <CreatePeriod /> : <EditPeriod periodId={periodId} />}
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function CreatePeriod() {
  const save = useSavePeriod("Periodo creado");
  const profileQuery = useQuery(orpc.institution.get.queryOptions());
  const summaryQuery = useQuery(orpc.period.summary.queryOptions());
  const createMutation = useMutation(orpc.period.create.mutationOptions());
  const activateMutation = useMutation(orpc.period.activate.mutationOptions());

  if (profileQuery.isPending || summaryQuery.isPending) {
    return <Loader />;
  }
  if (profileQuery.isError || summaryQuery.isError) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => {
          void profileQuery.refetch();
          void summaryQuery.refetch();
        }}
      />
    );
  }
  const isFirstPeriod = summaryQuery.data.length === 0;
  return (
    <PeriodFormFrame>
      <PeriodFormView
        mode="create"
        initialValues={emptyPeriodForm(profileQuery.data.currentAcademicYear, isFirstPeriod)}
        onSubmit={(input) =>
          save(() =>
            runPeriodSave(planPeriodSave(input, false), {
              write: (data) => createMutation.mutateAsync(data),
              activate: (id) => activateMutation.mutateAsync({ id }),
            }),
          )
        }
      />
    </PeriodFormFrame>
  );
}

function EditPeriod({ periodId }: { periodId: string }) {
  const save = useSavePeriod("Periodo actualizado");
  const periodQuery = useQuery(orpc.period.get.queryOptions({ input: { id: periodId } }));
  const updateMutation = useMutation(orpc.period.update.mutationOptions());
  const activateMutation = useMutation(orpc.period.activate.mutationOptions());

  if (periodQuery.isPending) {
    return <Loader />;
  }
  if (periodQuery.isError) {
    return (periodQuery.error as { code?: unknown }).code === "NOT_FOUND" ? (
      <EmptyState
        icon={<CalendarDays />}
        title="Periodo no encontrado"
        description="El periodo no existe o ya fue eliminado."
        action={
          <Link to="/periodos" className={buttonVariants()}>
            Volver a Periodos
          </Link>
        }
      />
    ) : (
      <LoadError
        message="No se pudo cargar el periodo."
        onRetry={() => void periodQuery.refetch()}
      />
    );
  }
  const wasActive = periodQuery.data.isActive;
  return (
    <PeriodFormFrame>
      <PeriodFormView
        mode="edit"
        initialValues={periodToFormValues(periodQuery.data)}
        onSubmit={(input) =>
          save(() =>
            runPeriodSave(planPeriodSave(input, wasActive), {
              write: async (data) => {
                await updateMutation.mutateAsync({ id: periodId, ...data });
                return { id: periodId };
              },
              activate: (id) => activateMutation.mutateAsync({ id }),
            }),
          )
        }
      />
    </PeriodFormFrame>
  );
}

/**
 * Runs a save, then toasts and refreshes the period queries. A full save returns to the list; a
 * save whose activation failed moves to the saved period's edit page so a retry cannot duplicate it.
 */
function useSavePeriod(successMessage: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (run: () => Promise<PeriodSaveOutcome>) => {
    const outcome = await run();
    if (outcome.activated) {
      toast.success(successMessage);
    } else {
      toast.warning(PERIOD_ACTIVATION_FAILED_MESSAGE);
    }
    await queryClient.invalidateQueries({ queryKey: orpc.period.key() });
    await (outcome.activated
      ? navigate({ to: "/periodos" })
      : navigate({ to: "/periodos/$id/editar", params: { id: outcome.id } }));
  };
}

function PeriodFormView(props: {
  mode: "create" | "edit";
  initialValues: PeriodFormValues;
  onSubmit: (input: PeriodInput) => Promise<void>;
}) {
  return <PeriodForm {...props} onInvalid={() => toast.error(INVALID_FORM_MESSAGE)} />;
}

function PeriodFormFrame({ children }: { children: ReactNode }) {
  return (
    <FormPageLayout
      form={children}
      help={
        <HelpCard title="Información">
          <p className="font-medium text-foreground">¿Qué es un periodo?</p>
          <p>Una división del año lectivo; al cerrarlo se consolidan las notas.</p>
          <p className="font-medium text-foreground">Periodo activo</p>
          <p>Solo uno a la vez. Para cambiarlo, activa otro periodo.</p>
          <p className="font-medium text-foreground">Fechas</p>
          <p>Los periodos de un mismo año no pueden superponerse.</p>
        </HelpCard>
      }
    />
  );
}
