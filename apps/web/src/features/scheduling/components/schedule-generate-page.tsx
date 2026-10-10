import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import { ActiveInstitutionGuard } from "@/features/institution";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { useGenerateSchedule } from "../hooks/use-generate-schedule";
import { generatableCourses } from "../lib/schedule-generation";
import GenerationHelp from "./generation-help";
import GenerationProgress from "./generation-progress";
import GenerationResult from "./generation-result";
import ScheduleGenerateForm from "./schedule-generate-form";

const BREADCRUMB_ROOT = { label: "Horarios de Clases", to: "/horarios" } as const;

/** SCH-12 `/horarios/generar` (container): unreachable without `schedule:generate` (SCH-R1). */
export default function ScheduleGeneratePage() {
  return (
    <ActiveInstitutionGuard pageName="sus horarios">
      <CanGate
        permission="schedule:generate"
        message="No tienes permiso para generar horarios en esta institución."
      >
        <PageHeader
          title="Generar Horario Automático"
          description="El sistema generará automáticamente los horarios evitando conflictos"
          breadcrumbs={[BREADCRUMB_ROOT, { label: "Generar" }]}
        />
        <ScheduleGenerateLoader />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function ScheduleGenerateLoader() {
  const profileQuery = useQuery(orpc.institution.get.queryOptions());
  const year = profileQuery.data?.currentAcademicYear;
  const coursesQuery = useQuery({
    ...orpc.course.options.queryOptions({ input: { academicYear: year } }),
    enabled: year !== undefined,
  });
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());

  const queries = [profileQuery, coursesQuery, campusesQuery];
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
  if (!coursesQuery.data || !campusesQuery.data) {
    return <Loader />;
  }
  return (
    <ScheduleGenerateContent
      campuses={campusesQuery.data}
      courses={generatableCourses(coursesQuery.data, campusesQuery.data)}
    />
  );
}

function ScheduleGenerateContent({
  campuses,
  courses,
}: {
  campuses: { id: string; name: string }[];
  courses: { id: string; name: string; campusId: string }[];
}) {
  const generation = useGenerateSchedule(courses);
  const { phase } = generation;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-4">
        <ScheduleGenerateForm
          campuses={campuses}
          courses={courses}
          isBusy={phase.name === "checking" || phase.name === "running"}
          onSubmit={(params) => void generation.request(params)}
        />
        {phase.name === "running" ? <GenerationProgress /> : null}
        {phase.name === "done" ? (
          <GenerationResult
            outcome={{ kind: "done", result: phase.result, viewCourseId: phase.viewCourseId }}
          />
        ) : null}
        {phase.name === "failed" ? <GenerationResult outcome={{ kind: "failed" }} /> : null}
      </div>
      <aside className="flex flex-col gap-4">
        <GenerationHelp />
      </aside>
      <ConfirmDialog
        open={phase.name === "confirming"}
        onOpenChange={(open) => {
          if (!open) {
            generation.cancel();
          }
        }}
        title="¿Reemplazar el horario existente?"
        description="Se reemplazará el horario de los grados seleccionados."
        confirmLabel="Reemplazar"
        cancelLabel="Cancelar"
        onConfirm={generation.confirm}
      />
    </div>
  );
}
