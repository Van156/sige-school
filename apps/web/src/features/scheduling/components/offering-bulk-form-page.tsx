import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
  FormPageLayout,
  HelpCard,
  INVALID_FORM_MESSAGE,
} from "@/features/institution";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useSaveAndReturn } from "../hooks/use-save-and-return";
import { courseCheckItems, subjectCheckItems, teacherOptions } from "../lib/offering-choices";
import { describeBulkResult, emptyBulkOfferingForm } from "../lib/offering-form";
import OfferingBulkForm from "./offering-bulk-form";

const BREADCRUMB_ROOT = { label: "Materias por Grado", to: "/materias-por-grado" } as const;

/** SCH-06 `/materias-por-grado/asignar` (container): unreachable without `offering:create` (SCH-R1). */
export default function OfferingBulkFormPage() {
  return (
    <ActiveInstitutionGuard pageName="sus materias por grado">
      <CanGate
        permission="offering:create"
        message="No tienes permiso para asignar materias a los grados de esta institución."
      >
        <PageHeader
          title="Asignar Materias a Grados"
          description="Asigna varias materias a uno o más grados a la vez"
          breadcrumbs={[BREADCRUMB_ROOT, { label: "Asignar" }]}
        />
        <OfferingBulkFormLoader />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function OfferingBulkFormLoader() {
  const save = useSaveAndReturn({ invalidate: orpc.offering.key(), to: "/materias-por-grado" });
  const coursesQuery = useQuery(orpc.course.options.queryOptions());
  const subjectsQuery = useQuery(orpc.subject.list.queryOptions());
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  const teachersQuery = useQuery(
    orpc.user.options.queryOptions({ input: { role: "teacher", limit: 50 } }),
  );
  const createBulk = useMutation(orpc.offering.createBulk.mutationOptions());

  const queries = [coursesQuery, subjectsQuery, campusesQuery, teachersQuery];
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

  const campusNames = new Map((campusesQuery.data ?? []).map((campus) => [campus.id, campus.name]));
  return (
    <FormPageLayout
      form={
        <OfferingBulkForm
          initialValues={emptyBulkOfferingForm}
          courses={courseCheckItems(coursesQuery.data ?? [], campusNames)}
          subjects={subjectCheckItems(subjectsQuery.data ?? [])}
          teachers={teacherOptions(teachersQuery.data ?? [])}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          onSubmit={(input) =>
            save(
              () => createBulk.mutateAsync(input),
              (result) => {
                const message = describeBulkResult(result);
                const show = message.kind === "info" ? toast.info : toast.success;
                show(message.title, { description: message.description });
              },
            )
          }
        />
      }
      help={
        <HelpCard title="Información">
          <ul className="list-disc pl-4">
            <li>Se crea una materia por cada combinación de grado y materia.</li>
            <li>Las combinaciones que ya existen se omiten.</li>
            <li>El profesor es opcional y se puede asignar luego en Asignación de Profesores.</li>
            <li>La intensidad define cuántos bloques semanales ocupa en el horario.</li>
          </ul>
        </HelpCard>
      }
    />
  );
}
