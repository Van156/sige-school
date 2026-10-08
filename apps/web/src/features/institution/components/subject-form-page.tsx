import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { INVALID_FORM_MESSAGE } from "../lib/form-messages";
import { subjectToFormValues, type SubjectInput } from "../lib/subject-form";
import ActiveInstitutionGuard from "./active-institution-guard";
import FormPageLayout, { HelpCard } from "./form-page-layout";
import SubjectForm from "./subject-form";

const BREADCRUMB_ROOT = { label: "Asignaturas", to: "/asignaturas" } as const;

/**
 * INS-14 `/asignaturas/nueva` and `/asignaturas/$id/editar` (container): create when `subjectId`
 * is omitted, else edit. Forms are unreachable without the mutation permission (INS-R1).
 */
export default function SubjectFormPage({ subjectId }: { subjectId?: string }) {
  const title = subjectId === undefined ? "Nueva Asignatura" : "Editar Asignatura";
  return (
    <ActiveInstitutionGuard pageName="sus asignaturas">
      <CanGate
        permission={subjectId === undefined ? "subject:create" : "subject:update"}
        message="No tienes permiso para gestionar las asignaturas de esta institución."
      >
        <PageHeader
          title={title}
          description="Materia que se dicta en la institución"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        {subjectId === undefined ? <CreateSubject /> : <EditSubject subjectId={subjectId} />}
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function CreateSubject() {
  const save = useSaveSubject("Asignatura creada");
  const createMutation = useMutation(orpc.subject.create.mutationOptions());
  return (
    <SubjectFormFrame>
      <SubjectFormView
        mode="create"
        onSubmit={(input) => save(() => createMutation.mutateAsync(input))}
      />
    </SubjectFormFrame>
  );
}

function EditSubject({ subjectId }: { subjectId: string }) {
  const save = useSaveSubject("Asignatura actualizada");
  const subjectQuery = useQuery(orpc.subject.get.queryOptions({ input: { id: subjectId } }));
  const updateMutation = useMutation(orpc.subject.update.mutationOptions());

  if (subjectQuery.isPending) {
    return <Loader />;
  }
  if (subjectQuery.isError) {
    return (subjectQuery.error as { code?: unknown }).code === "NOT_FOUND" ? (
      <EmptyState
        icon={<BookOpen />}
        title="Asignatura no encontrada"
        description="La asignatura no existe o ya fue eliminada."
        action={
          <Link to="/asignaturas" className={buttonVariants()}>
            Volver a Asignaturas
          </Link>
        }
      />
    ) : (
      <LoadError
        message="No se pudo cargar la asignatura."
        onRetry={() => void subjectQuery.refetch()}
      />
    );
  }
  return (
    <SubjectFormFrame>
      <SubjectFormView
        mode="edit"
        initialValues={subjectToFormValues(subjectQuery.data)}
        onSubmit={(input) => save(() => updateMutation.mutateAsync({ id: subjectId, ...input }))}
      />
    </SubjectFormFrame>
  );
}

/** Runs a save, then toasts, refreshes the subject queries and returns to the list. */
function useSaveSubject(successMessage: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (run: () => Promise<unknown>) => {
    await run();
    toast.success(successMessage);
    await queryClient.invalidateQueries({ queryKey: orpc.subject.key() });
    await navigate({ to: "/asignaturas" });
  };
}

function SubjectFormView(props: {
  mode: "create" | "edit";
  initialValues?: ReturnType<typeof subjectToFormValues>;
  onSubmit: (input: SubjectInput) => Promise<void>;
}) {
  return <SubjectForm {...props} onInvalid={() => toast.error(INVALID_FORM_MESSAGE)} />;
}

function SubjectFormFrame({ children }: { children: ReactNode }) {
  return (
    <FormPageLayout
      form={children}
      help={
        <HelpCard title="Información">
          <p className="font-medium text-foreground">¿Qué es una asignatura?</p>
          <p>Una materia que se dicta en la institución; luego se asigna a los grados.</p>
          <p className="font-medium text-foreground">Código</p>
          <p>Opcional, pero no puede repetirse entre asignaturas.</p>
        </HelpCard>
      }
    />
  );
}
