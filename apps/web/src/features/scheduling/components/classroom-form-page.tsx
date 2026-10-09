import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DoorOpen } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
  campusChoices,
  FormPageLayout,
  HelpCard,
  INVALID_FORM_MESSAGE,
} from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import { useSaveAndReturn } from "../hooks/use-save-and-return";
import {
  classroomToFormValues,
  emptyClassroomForm,
  type ClassroomInput,
} from "../lib/classroom-form";
import ClassroomForm from "./classroom-form";

const BREADCRUMB_ROOT = { label: "Salones", to: "/salones" } as const;

/**
 * SCH-08 `/salones/nuevo` and `/salones/$id/editar` (container): create when `classroomId` is
 * omitted, else edit. Forms are unreachable without the mutation permission (SCH-R1).
 */
export default function ClassroomFormPage({ classroomId }: { classroomId?: string }) {
  const title = classroomId === undefined ? "Nuevo Salón" : "Editar Salón";
  return (
    <ActiveInstitutionGuard pageName="sus salones">
      <CanGate
        permission={classroomId === undefined ? "classroom:create" : "classroom:update"}
        message="No tienes permiso para gestionar los salones de esta institución."
      >
        <PageHeader
          title={title}
          description="Salón o espacio físico donde se dictan las clases"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        <ClassroomFormLoader classroomId={classroomId} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function ClassroomFormLoader({ classroomId }: { classroomId?: string }) {
  const save = useSaveAndReturn({ invalidate: orpc.classroom.key(), to: "/salones" });
  const isEdit = classroomId !== undefined;
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  const classroomQuery = useQuery({
    ...orpc.classroom.get.queryOptions({ input: { id: classroomId ?? "" } }),
    enabled: isEdit,
  });
  const createMutation = useMutation(orpc.classroom.create.mutationOptions());
  const updateMutation = useMutation(orpc.classroom.update.mutationOptions());

  if (isEdit && classroomQuery.isError && isNotFoundError(classroomQuery.error)) {
    return (
      <EmptyState
        icon={<DoorOpen />}
        title="Salón no encontrado"
        description="El salón no existe o ya fue eliminado."
        action={
          <Link to="/salones" className={buttonVariants()}>
            Volver a Salones
          </Link>
        }
      />
    );
  }
  if (campusesQuery.isError || (isEdit && classroomQuery.isError)) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => {
          void campusesQuery.refetch();
          if (isEdit) {
            void classroomQuery.refetch();
          }
        }}
      />
    );
  }
  if (campusesQuery.isPending || (isEdit && classroomQuery.isPending)) {
    return <Loader />;
  }

  const classroom = isEdit ? classroomQuery.data : undefined;
  return (
    <ClassroomFormFrame>
      <ClassroomForm
        mode={isEdit ? "edit" : "create"}
        initialValues={classroom ? classroomToFormValues(classroom) : emptyClassroomForm}
        campuses={campusChoices(campusesQuery.data, classroom)}
        onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
        onSubmit={(input: ClassroomInput) =>
          classroom
            ? save(
                () => updateMutation.mutateAsync({ id: classroom.id, ...input }),
                "Salón actualizado",
              )
            : save(() => createMutation.mutateAsync(input), "Salón creado")
        }
      />
    </ClassroomFormFrame>
  );
}

function ClassroomFormFrame({ children }: { children: ReactNode }) {
  return (
    <FormPageLayout
      form={children}
      help={
        <HelpCard title="Información">
          <p className="font-medium text-foreground">Tipos de salón</p>
          <ul className="list-disc pl-4">
            <li>Aula: clases regulares.</li>
            <li>Laboratorio: ciencias y sistemas.</li>
            <li>Auditorio: eventos y reuniones.</li>
            <li>Cancha: educación física.</li>
          </ul>
          <p className="font-medium text-foreground">Consejos</p>
          <ul className="list-disc pl-4">
            <li>El generador de horarios usa el tipo para elegir el salón de cada materia.</li>
            <li>La capacidad evita sobrecupo en la asignación.</li>
          </ul>
        </HelpCard>
      }
    />
  );
}
