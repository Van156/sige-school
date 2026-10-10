import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
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
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import { useSaveAndReturn } from "../hooks/use-save-and-return";
import {
  candidateCheckItems,
  ENROLL_SAVE_FALLBACK,
  enrollmentCourseOptions,
  enrollOrAskOverride,
  enrollSuccessToast,
  mapEnrollSubmitError,
  overCapacityMessage,
  type EnrollInput,
} from "../lib/enrollment-form";
import { ENROLLMENT_ACTIONS } from "../lib/enrollment-permissions";
import type { EnrollmentCandidateCourse } from "../types";
import EnrollmentCreateForm, { type EnrollmentCandidatesState } from "./enrollment-create-form";
import EnrollmentEditForm from "./enrollment-edit-form";

const BREADCRUMB_ROOT = { label: "Matrículas", to: "/matriculas" } as const;

/**
 * SCH-02 `/matriculas/nueva` and `/matriculas/$id/editar` (container): create when
 * `enrollmentId` is omitted, else edit. Forms are unreachable without `enrollment:create` /
 * `enrollment:update` (SCH-R1).
 */
export default function EnrollmentFormPage({ enrollmentId }: { enrollmentId?: string }) {
  const isCreate = enrollmentId === undefined;
  const title = isCreate ? "Nueva Matrícula" : "Editar Matrícula";
  return (
    <ActiveInstitutionGuard pageName="sus matrículas">
      <CanGate
        permission={isCreate ? ENROLLMENT_ACTIONS.create : ENROLLMENT_ACTIONS.edit}
        message={
          isCreate
            ? "No tienes permiso para matricular estudiantes en esta institución."
            : "No tienes permiso para editar matrículas en esta institución."
        }
      >
        <PageHeader
          title={title}
          description="Matricula estudiantes en todas las materias de un grado"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        {isCreate ? (
          <EnrollmentCreateLoader />
        ) : (
          <EnrollmentEditLoader enrollmentId={enrollmentId} />
        )}
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

/** A refused-over-capacity submission awaiting "Matricular de todos modos". */
type PendingOverride = { input: EnrollInput; course: EnrollmentCandidateCourse };

function EnrollmentCreateLoader() {
  const save = useSaveAndReturn({ invalidate: orpc.enrollment.key(), to: "/matriculas" });
  const [courseId, setCourseId] = useState("");
  const [pendingOverride, setPendingOverride] = useState<PendingOverride | null>(null);
  const institutionQuery = useQuery(orpc.institution.get.queryOptions());
  const coursesQuery = useQuery(orpc.course.options.queryOptions({ input: {} }));
  const candidatesQuery = useQuery({
    ...orpc.enrollment.candidates.queryOptions({ input: { courseId } }),
    enabled: courseId !== "",
  });
  const createBulk = useMutation(orpc.enrollment.createBulk.mutationOptions());

  const queries = [institutionQuery, coursesQuery];
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
  if (institutionQuery.data === undefined || coursesQuery.data === undefined) {
    return <Loader />;
  }

  const academicYear = institutionQuery.data.currentAcademicYear;
  const candidates: EnrollmentCandidatesState =
    courseId === ""
      ? { status: "idle" }
      : candidatesQuery.isError
        ? { status: "error", onRetry: () => void candidatesQuery.refetch() }
        : candidatesQuery.data === undefined
          ? { status: "loading" }
          : {
              status: "ready",
              course: candidatesQuery.data.course,
              students: candidateCheckItems(candidatesQuery.data.students),
            };

  /** Saves with the success toast, refreshes the enrollment queries and returns to SCH-01. */
  const enroll = (input: EnrollInput, course: EnrollmentCandidateCourse) =>
    save(
      () => createBulk.mutateAsync(input),
      (result) => {
        const message = enrollSuccessToast(result, course.name);
        toast.success(message.title, { description: message.description });
      },
    );

  const onSubmit = async (input: EnrollInput) => {
    // The checklist only lists students once the chosen course's candidates loaded.
    const course = candidatesQuery.data?.course;
    if (course === undefined || course.id !== input.courseId) {
      throw new Error("The candidates of the chosen course are not loaded.");
    }
    await enrollOrAskOverride({
      input,
      course,
      enroll: (value) => enroll(value, course),
      askOverride: (value) => setPendingOverride({ input: value, course }),
    });
  };

  const confirmOverride = async () => {
    if (pendingOverride === null) {
      return;
    }
    try {
      await enroll({ ...pendingOverride.input, allowOverCapacity: true }, pendingOverride.course);
    } catch (error) {
      const failure = mapEnrollSubmitError(error);
      toast.error(
        failure.formError ?? Object.values(failure.fieldErrors)[0] ?? ENROLL_SAVE_FALLBACK,
      );
    }
  };

  return (
    <>
      <FormPageLayout
        form={
          <EnrollmentCreateForm
            courses={enrollmentCourseOptions(coursesQuery.data, academicYear)}
            candidates={candidates}
            onCourseChange={setCourseId}
            onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
            onSubmit={onSubmit}
          />
        }
        help={
          <HelpCard title="Información">
            <p className="font-medium text-foreground">Año académico {academicYear}</p>
            <ul className="list-disc pl-4">
              <li>Cada estudiante queda inscrito en todas las materias del grado.</li>
              <li>El estudiante pasa a pertenecer al grado seleccionado.</li>
              <li>No se supera la capacidad máxima del grado.</li>
              <li>Para cambiar el estado de una inscripción usa la edición.</li>
            </ul>
          </HelpCard>
        }
      />
      <ConfirmDialog
        open={pendingOverride !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingOverride(null);
          }
        }}
        title="Capacidad máxima del grado"
        description={pendingOverride ? overCapacityMessage(pendingOverride.course) : undefined}
        confirmLabel="Matricular de todos modos"
        cancelLabel="Cancelar"
        destructive={false}
        onConfirm={confirmOverride}
      />
    </>
  );
}

function EnrollmentEditLoader({ enrollmentId }: { enrollmentId: string }) {
  const save = useSaveAndReturn({ invalidate: orpc.enrollment.key(), to: "/matriculas" });
  const enrollmentQuery = useQuery(
    orpc.enrollment.get.queryOptions({ input: { id: enrollmentId } }),
  );
  const update = useMutation(orpc.enrollment.update.mutationOptions());

  if (enrollmentQuery.isError && isNotFoundError(enrollmentQuery.error)) {
    return (
      <EmptyState
        icon={<ClipboardList />}
        title="Matrícula no encontrada"
        description="La matrícula no existe o ya fue eliminada."
        action={
          <Link to="/matriculas" className={buttonVariants()}>
            Volver a Matrículas
          </Link>
        }
      />
    );
  }
  if (enrollmentQuery.isError) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => void enrollmentQuery.refetch()}
      />
    );
  }
  if (enrollmentQuery.isPending) {
    return <Loader />;
  }

  const enrollment = enrollmentQuery.data;
  return (
    <FormPageLayout
      form={
        <EnrollmentEditForm
          enrollment={enrollment}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          onSubmit={(input) =>
            save(() => update.mutateAsync({ id: enrollment.id, ...input }), "Matrícula actualizada")
          }
        />
      }
      help={
        <HelpCard title="Información">
          <ul className="list-disc pl-4">
            <li>Solo el estado, la nota final y las observaciones son editables.</li>
            <li>Cancelada o retirada deja la materia fuera del cálculo de notas.</li>
            <li>La nota final de la matrícula es independiente de las notas del periodo.</li>
          </ul>
        </HelpCard>
      }
    />
  );
}
