import { useNavigate } from "@tanstack/react-router";

import { useSigeMe } from "@/app/use-nav-context";
import { CanGate } from "@/features/access-control";
import { ActiveInstitutionBanner, ActiveInstitutionGuard } from "@/features/institution";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import NoPermission from "@/shared/components/feedback/no-permission";
import PageHeader from "@/shared/components/layout/page-header";

import { scheduleAudience, scheduleDescription, type ScheduleSearch } from "../lib/schedule-view";
import ManagerSchedule from "./manager-schedule";
import OwnSchedule from "./own-schedule";

const NO_PERMISSION_MESSAGE = "No tienes permiso para ver los horarios de esta institución.";

/** SCH-11 `/horarios` (container): picks the manager, teacher or student view from the caller's kind. */
export default function SchedulesPage({ search }: { search: ScheduleSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus horarios">
      <SchedulesContent search={search} />
    </ActiveInstitutionGuard>
  );
}

function SchedulesContent({ search }: { search: ScheduleSearch }) {
  const navigate = useNavigate({ from: "/horarios/" });
  const { data: me, isPending, isError, refetch } = useSigeMe();

  if (isPending) {
    return <Loader />;
  }
  if (isError) {
    return <LoadError message="No se pudo cargar su información." onRetry={() => void refetch()} />;
  }

  const audience = scheduleAudience(me?.kind ?? null);
  if (audience === "none") {
    return <NoPermission message={NO_PERMISSION_MESSAGE} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Horarios de Clases" description={scheduleDescription(audience)} />
      <ActiveInstitutionBanner />
      {audience === "manager" ? (
        <CanGate permission="schedule:read" message={NO_PERMISSION_MESSAGE}>
          <ManagerSchedule
            courseId={search.courseId}
            onCourseChange={(courseId) => void navigate({ search: { courseId }, replace: true })}
          />
        </CanGate>
      ) : (
        <OwnSchedule audience={audience} />
      )}
    </div>
  );
}
