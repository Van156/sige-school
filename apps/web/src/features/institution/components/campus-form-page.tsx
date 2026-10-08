import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { campusToFormValues, type CampusInput } from "../lib/campus-form";
import { INVALID_FORM_MESSAGE } from "../lib/form-messages";
import ActiveInstitutionGuard from "./active-institution-guard";
import CampusForm from "./campus-form";
import FormPageLayout, { HelpCard } from "./form-page-layout";

const BREADCRUMB_ROOT = { label: "Sedes", to: "/sedes" } as const;

/**
 * INS-08 `/sedes/nueva` and `/sedes/$id/editar` (container): create when `campusId` is omitted,
 * else edit. Forms are unreachable without the mutation permission (INS-R1): `NoPermission`.
 */
export default function CampusFormPage({ campusId }: { campusId?: string }) {
  return (
    <ActiveInstitutionGuard pageName="sus sedes">
      <CanGate
        permission={campusId === undefined ? "campus:create" : "campus:update"}
        message="No tienes permiso para gestionar las sedes de esta institución."
      >
        <PageHeader
          title={campusId === undefined ? "Nueva Sede" : "Editar Sede"}
          description="Datos de la ubicación física de la institución"
          breadcrumbs={[
            BREADCRUMB_ROOT,
            { label: campusId === undefined ? "Nueva Sede" : "Editar Sede" },
          ]}
        />
        {campusId === undefined ? <CreateCampus /> : <EditCampus campusId={campusId} />}
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function CreateCampus() {
  const save = useSaveCampus("Sede creada");
  const createMutation = useMutation(orpc.campus.create.mutationOptions());
  return (
    <CampusFormFrame>
      <CampusFormView
        mode="create"
        onSubmit={(input) => save(() => createMutation.mutateAsync(input))}
      />
    </CampusFormFrame>
  );
}

function EditCampus({ campusId }: { campusId: string }) {
  const save = useSaveCampus("Sede actualizada");
  const campusQuery = useQuery(orpc.campus.get.queryOptions({ input: { id: campusId } }));
  const updateMutation = useMutation(orpc.campus.update.mutationOptions());

  if (campusQuery.isPending) {
    return <Loader />;
  }
  if (campusQuery.isError) {
    return (campusQuery.error as { code?: unknown }).code === "NOT_FOUND" ? (
      <EmptyState
        icon={<Building2 />}
        title="Sede no encontrada"
        description="La sede no existe o ya fue eliminada."
        action={
          <Link to="/sedes" className={buttonVariants()}>
            Volver a Sedes
          </Link>
        }
      />
    ) : (
      <LoadError message="No se pudo cargar la sede." onRetry={() => void campusQuery.refetch()} />
    );
  }
  return (
    <CampusFormFrame>
      <CampusFormView
        mode="edit"
        initialValues={campusToFormValues(campusQuery.data)}
        onSubmit={(input) => save(() => updateMutation.mutateAsync({ id: campusId, ...input }))}
      />
    </CampusFormFrame>
  );
}

/** Runs a save, then toasts, refreshes the campus queries and returns to the list. */
function useSaveCampus(successMessage: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (run: () => Promise<unknown>) => {
    await run();
    toast.success(successMessage);
    await queryClient.invalidateQueries({ queryKey: orpc.campus.key() });
    await navigate({ to: "/sedes" });
  };
}

function CampusFormView(props: {
  mode: "create" | "edit";
  initialValues?: ReturnType<typeof campusToFormValues>;
  onSubmit: (input: CampusInput) => Promise<void>;
}) {
  return <CampusForm {...props} onInvalid={() => toast.error(INVALID_FORM_MESSAGE)} />;
}

function CampusFormFrame({ children }: { children: ReactNode }) {
  return (
    <FormPageLayout
      form={children}
      help={
        <>
          <HelpCard title="Información">
            <p className="font-medium text-foreground">¿Qué es una sede?</p>
            <p>Una ubicación física de la institución donde se imparten clases.</p>
            <p className="font-medium text-foreground">Sede Principal</p>
            <p>Una por institución, generalmente la administrativa; se destaca en el listado.</p>
          </HelpCard>
          <HelpCard title="Consejos">
            <ul className="list-disc space-y-1 pl-4">
              <li>Usa un código único para cada sede.</li>
              <li>Prefiere nombres descriptivos.</li>
              <li>La jornada determina los horarios de clase.</li>
              <li>Desactiva las sedes en desuso en lugar de eliminarlas.</li>
            </ul>
          </HelpCard>
        </>
      }
    />
  );
}
