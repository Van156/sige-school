import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import ScheduleCard from "./schedule-card";

/**
 * SCH-11 for a teacher (`view: "teacher"`, their own `activo`/`temporal` classes, course badge on
 * each cell) or a student (their course: `courseId` is omitted, the server resolves it). A student
 * without a course or academic profile gets `NOT_FOUND` and sees "Sin curso asignado".
 */
export default function OwnSchedule({ audience }: { audience: "teacher" | "student" }) {
  const scheduleQuery = useQuery({
    ...orpc.schedule.get.queryOptions({
      input: audience === "teacher" ? { view: "teacher" } : { view: "course" },
    }),
    retry: false,
  });

  if (scheduleQuery.isPending) {
    return <Loader />;
  }
  if (scheduleQuery.isError) {
    if (audience === "student" && isNotFoundError(scheduleQuery.error)) {
      return (
        <EmptyState
          icon={<CalendarClock />}
          title="Sin curso asignado"
          description="No estás asignado a ningún curso. Contacta con coordinación académica."
        />
      );
    }
    return (
      <LoadError
        message="No se pudo cargar el horario."
        onRetry={() => void scheduleQuery.refetch()}
      />
    );
  }
  return <ScheduleCard schedule={scheduleQuery.data} showCourse={audience === "teacher"} />;
}
