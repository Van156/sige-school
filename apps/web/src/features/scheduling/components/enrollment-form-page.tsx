import { useMutation, useQuery } from "@tanstack/react-query";
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
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

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

const BREADCRUMB_ROOT = { label: "Matrículas", to: "/matriculas" } as const;

/**
 * SCH-02 `/matriculas/nueva` (container). Unreachable without `enrollment:create` (SCH-R1).
 */
export default function EnrollmentFormPage() {
  const title = "Nueva Matrícula";
  return (
    <ActiveInstitutionGuard pageName="sus matrículas">
      <CanGate
        permission={ENROLLMENT_ACTIONS.create}
        message="No tienes permiso para matricular estudiantes en esta institución."
      >
        <PageHeader
          title={title}
          description="Matricula estudiantes en todas las materias de un grado"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        <EnrollmentCreateLoader />
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
