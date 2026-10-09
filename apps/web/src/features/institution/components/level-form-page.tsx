import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Layers } from "lucide-react";
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
  campusChoices,
  levelToFormValues,
  toLevelUpdate,
  type LevelFormValues,
  type LevelInput,
} from "../lib/level-form";
import type { CampusOption } from "../types";
import ActiveInstitutionGuard from "./active-institution-guard";
import FormPageLayout, { HelpCard } from "./form-page-layout";
import LevelForm from "./level-form";

const BREADCRUMB_ROOT = { label: "Niveles Académicos", to: "/niveles" } as const;

/**
 * INS-10 `/niveles/nuevo` and `/niveles/$id/editar` (container): create when `levelId` is omitted,
 * else edit. Forms are unreachable without the mutation permission (INS-R1): `NoPermission`.
 */
export default function LevelFormPage({ levelId }: { levelId?: string }) {
  const title = levelId === undefined ? "Nuevo Nivel Académico" : "Editar Nivel Académico";
  return (
    <ActiveInstitutionGuard pageName="sus niveles académicos">
      <CanGate
        permission={levelId === undefined ? "level:create" : "level:update"}
        message="No tienes permiso para gestionar los niveles académicos de esta institución."
      >
        <PageHeader
          title={title}
          description="Agrupa los cursos de una sede por nivel"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        {levelId === undefined ? <CreateLevel /> : <EditLevel levelId={levelId} />}
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function CreateLevel() {
  const save = useSaveLevel("Nivel creado");
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  const createMutation = useMutation(orpc.level.create.mutationOptions());

  if (campusesQuery.isPending) {
    return <Loader />;
  }
  if (campusesQuery.isError) {
    return (
      <LoadError
        message="No se pudieron cargar las sedes."
        onRetry={() => void campusesQuery.refetch()}
      />
    );
  }
  return (
    <LevelFormFrame>
      <LevelFormView
        mode="create"
        campuses={campusChoices(campusesQuery.data)}
        onSubmit={(input) => save(() => createMutation.mutateAsync(input))}
      />
    </LevelFormFrame>
  );
}

function EditLevel({ levelId }: { levelId: string }) {
  const save = useSaveLevel("Nivel actualizado");
  // There is no `level.get`: the bounded list is already cached by the listing screen.
  const levelsQuery = useQuery(orpc.level.list.queryOptions({ input: {} }));
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  const updateMutation = useMutation(orpc.level.update.mutationOptions());

  if (levelsQuery.isPending || campusesQuery.isPending) {
    return <Loader />;
  }
  if (levelsQuery.isError || campusesQuery.isError) {
    return (
      <LoadError
        message="No se pudo cargar el nivel."
        onRetry={() => {
          void levelsQuery.refetch();
          void campusesQuery.refetch();
        }}
      />
    );
  }
  const level = levelsQuery.data.find((row) => row.id === levelId);
  if (!level) {
    return (
      <EmptyState
        icon={<Layers />}
        title="Nivel no encontrado"
        description="El nivel no existe o ya fue eliminado."
        action={
          <Link to="/niveles" className={buttonVariants()}>
            Volver a Niveles
          </Link>
        }
      />
    );
  }
  return (
    <LevelFormFrame>
      <LevelFormView
        mode="edit"
        initialValues={levelToFormValues(level)}
        campuses={campusChoices(campusesQuery.data, level)}
        onSubmit={(input) =>
          save(() => updateMutation.mutateAsync({ id: levelId, ...toLevelUpdate(input) }))
        }
      />
    </LevelFormFrame>
  );
}

/** Runs a save, then toasts, refreshes the level queries and returns to the list. */
function useSaveLevel(successMessage: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (run: () => Promise<unknown>) => {
    await run();
    toast.success(successMessage);
    await queryClient.invalidateQueries({ queryKey: orpc.level.key() });
    await navigate({ to: "/niveles" });
  };
}

function LevelFormView(props: {
  mode: "create" | "edit";
  campuses: readonly CampusOption[];
  initialValues?: LevelFormValues;
  onSubmit: (input: LevelInput) => Promise<void>;
}) {
  return <LevelForm {...props} onInvalid={() => toast.error(INVALID_FORM_MESSAGE)} />;
}

function LevelFormFrame({ children }: { children: ReactNode }) {
  return (
    <FormPageLayout
      form={children}
      help={
        <HelpCard title="¿Qué es un Nivel Académico?">
          <p>Agrupa los cursos de una sede, por ejemplo Primero, Sexto u Once.</p>
          <pre className="rounded-md bg-muted p-2 font-mono text-xs leading-5 text-foreground">
            {"Sede\n└─ Nivel\n   └─ Curso"}
          </pre>
          <p>El orden define cómo se listan los niveles (0 = primero).</p>
        </HelpCard>
      }
    />
  );
}
