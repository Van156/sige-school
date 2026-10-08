import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import ListPageShell from "@/shared/components/layout/list-page-shell";

import { useCanManage } from "../hooks/use-can-manage";
import { useDeleteEntity } from "../hooks/use-delete-entity";
import { periodCountWarning, resolveYear, yearChoices } from "../lib/period-list";
import type { PeriodRow } from "../types";
import ActiveInstitutionBanner from "./active-institution-banner";
import ActiveInstitutionGuard from "./active-institution-guard";
import ConfirmDelete from "./confirm-delete";
import PeriodCountWarning from "./period-count-warning";
import PeriodYearSelect from "./period-year-select";
import PeriodsTable from "./periods-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar los periodos académicos.";

/** INS-15 `/periodos` (container): periods of one academic year, read-only without `period:create`. */
export default function PeriodsPage() {
  return (
    <ActiveInstitutionGuard pageName="sus periodos académicos">
      <PeriodsContent />
    </ActiveInstitutionGuard>
  );
}

function PeriodsContent() {
  const queryClient = useQueryClient();
  const canManage = useCanManage("period");
  const profileQuery = useQuery(orpc.institution.get.queryOptions());
  const summaryQuery = useQuery(orpc.period.summary.queryOptions());
  const [pickedYear, setPickedYear] = useState<string | null>(null);

  const summary = summaryQuery.data ?? [];
  const currentYear = profileQuery.data?.currentAcademicYear;
  const years = yearChoices(summary, currentYear);
  const year = resolveYear(pickedYear, currentYear, years);

  const periodsQuery = useQuery({
    ...orpc.period.list.queryOptions({ input: { academicYear: year ?? undefined } }),
    enabled: year !== null,
  });
  const { mutateAsync: activatePeriod } = useMutation(orpc.period.activate.mutationOptions());
  const deleteMutation = useMutation(orpc.period.delete.mutationOptions());
  const deletion = useDeleteEntity<PeriodRow>({
    remove: (period) => deleteMutation.mutateAsync({ id: period.id }),
    invalidate: orpc.period.key(),
    successMessage: () => "Periodo eliminado",
  });

  const activate = useCallback(
    (period: PeriodRow) => {
      void (async () => {
        try {
          await activatePeriod({ id: period.id });
          toast.success(`Periodo ${period.name} activado`);
          await queryClient.invalidateQueries({ queryKey: orpc.period.key() });
        } catch (error) {
          toast.error(`No se pudo activar ${period.name}`, {
            description: error instanceof Error ? error.message : undefined,
          });
        }
      })();
    },
    [activatePeriod, queryClient],
  );

  const periods = periodsQuery.data;
  // Until both lookups settle there is no year to list; after they settle without one, nothing exists.
  const yearPending = year === null && (profileQuery.isPending || summaryQuery.isPending);
  const createLink = (label: string) => (
    <Link to="/periodos/nuevo" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );
  const warning =
    year === null || !summaryQuery.isSuccess ? null : periodCountWarning(summary, year);

  return (
    <>
      <ListPageShell
        title="Periodos Académicos"
        description="Divisiones del año lectivo en las que se cierran las notas"
        actions={canManage ? createLink("Nuevo Periodo") : undefined}
        banner={<ActiveInstitutionBanner />}
        listTitle="Listado de Periodos"
        listAction={
          year !== null && years.length > 0 ? (
            <PeriodYearSelect years={years} value={year} onChange={setPickedYear} />
          ) : undefined
        }
      >
        {warning ? <PeriodCountWarning message={warning} /> : null}
        {profileQuery.isError || summaryQuery.isError ? (
          <LoadError
            message={LOAD_ERROR_MESSAGE}
            onRetry={() => {
              void profileQuery.refetch();
              void summaryQuery.refetch();
            }}
          />
        ) : yearPending || (year !== null && periodsQuery.isPending) ? (
          <Loader />
        ) : periodsQuery.isError ? (
          <LoadError message={LOAD_ERROR_MESSAGE} onRetry={() => void periodsQuery.refetch()} />
        ) : (periods ?? []).length === 0 ? (
          <EmptyState
            icon={<CalendarDays />}
            title="No hay periodos"
            description={
              year === null
                ? "Crea los periodos del año lectivo para cerrar las notas."
                : `Crea los periodos del año ${year} para cerrar las notas.`
            }
            action={canManage ? createLink("Crear Primer Periodo") : undefined}
          />
        ) : (
          <PeriodsTable
            periods={periods ?? []}
            canManage={canManage}
            isPending={false}
            errorMessage={null}
            onRetry={() => void periodsQuery.refetch()}
            onActivate={activate}
            onDelete={deletion.requestDelete}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title={`¿Eliminar periodo ${deletion.target?.name ?? ""}?`}
        description="Esta acción no se puede deshacer. El periodo activo no se puede eliminar."
      />
    </>
  );
}
