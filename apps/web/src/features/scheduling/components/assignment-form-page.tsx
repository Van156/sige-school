import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
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
import { courseFilterOptions, subjectFilterOptions, teacherOptions } from "../lib/offering-choices";
import AssignmentCreateForm from "./assignment-create-form";
import AssignmentEditForm from "./assignment-edit-form";

const BREADCRUMB_ROOT = { label: "Asignación de Profesores", to: "/asignaciones" } as const;

/**
 * SCH-04 `/asignaciones/nueva` and `/asignaciones/$id/editar` (container): create when
 * `assignmentId` is omitted, else edit. Forms are unreachable without `offering:update` (SCH-R1).
 */
export default function AssignmentFormPage({ assignmentId }: { assignmentId?: string }) {
  const title = assignmentId === undefined ? "Nueva Asignación de Profesor" : "Editar Asignación";
  return (
    <ActiveInstitutionGuard pageName="sus asignaciones de profesores">
      <CanGate
        permission="offering:update"
        message="No tienes permiso para asignar profesores en esta institución."
      >
        <PageHeader
          title={title}
          description="Asigna un profesor a una materia de un grado"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        {assignmentId === undefined ? (
          <AssignmentCreateLoader />
        ) : (
          <AssignmentEditLoader assignmentId={assignmentId} />
        )}
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function AssignmentCreateLoader() {
  const save = useSaveAndReturn({ invalidate: orpc.assignment.key(), to: "/asignaciones" });
  const coursesQuery = useQuery(orpc.course.options.queryOptions());
  const subjectsQuery = useQuery(orpc.subject.list.queryOptions());
  const teachersQuery = useQuery(
    orpc.user.options.queryOptions({ input: { role: "teacher", limit: 50 } }),
  );
  const assign = useMutation(orpc.assignment.assign.mutationOptions());

  const queries = [coursesQuery, subjectsQuery, teachersQuery];
  if (queries.some((query) => query.isError)) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => {
          for (const query of queries) {
            if (query.isError) {
              void query.refetch();
            }
          }
        }}
      />
    );
  }
  if (queries.some((query) => query.isPending)) {
    return <Loader />;
  }

  return (
    <FormPageLayout
      form={
        <AssignmentCreateForm
          courses={courseFilterOptions(coursesQuery.data ?? [])}
          subjects={subjectFilterOptions(subjectsQuery.data ?? [])}
          teachers={teacherOptions(teachersQuery.data ?? [])}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          onSubmit={(input) => save(() => assign.mutateAsync(input), "Profesor asignado")}
        />
      }
      help={
        <HelpCard title="Información">
          <ul className="list-disc pl-4">
            <li>Si la materia ya existe en el grado, solo cambia su profesor.</li>
            <li>Si no existe, se crea con 4 horas semanales.</li>
            <li>El profesor solo puede tomar notas y asistencia de sus asignaciones.</li>
            <li>Una materia de un grado tiene un único profesor.</li>
          </ul>
        </HelpCard>
      }
    />
  );
}

function AssignmentEditLoader({ assignmentId }: { assignmentId: string }) {
  const save = useSaveAndReturn({ invalidate: orpc.assignment.key(), to: "/asignaciones" });
  const assignmentQuery = useQuery(
    orpc.assignment.get.queryOptions({ input: { id: assignmentId } }),
  );
  const update = useMutation(orpc.assignment.update.mutationOptions());

  if (assignmentQuery.isError && isNotFoundError(assignmentQuery.error)) {
    return (
      <EmptyState
        icon={<UserCheck />}
        title="Asignación no encontrada"
        description="La asignación no existe o ya fue eliminada."
        action={
          <Link to="/asignaciones" className={buttonVariants()}>
            Volver a Asignaciones
          </Link>
        }
      />
    );
  }
  if (assignmentQuery.isError) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => void assignmentQuery.refetch()}
      />
    );
  }
  if (assignmentQuery.isPending) {
    return <Loader />;
  }

  const assignment = assignmentQuery.data;
  return (
    <FormPageLayout
      form={
        <AssignmentEditForm
          assignment={assignment}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          onSubmit={(input) =>
            save(
              () => update.mutateAsync({ id: assignment.id, ...input }),
              "Asignación actualizada",
            )
          }
        />
      }
    />
  );
}
