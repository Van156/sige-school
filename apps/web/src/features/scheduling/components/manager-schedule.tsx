import { buttonVariants } from "@base-template/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

import { orpc } from "@/app/orpc";
import { useCan } from "@/features/access-control";
import { ConfirmDelete } from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useRemoveSlot } from "../hooks/use-remove-slot";
import { REMOVE_SLOT_QUESTION, resolveCourseId } from "../lib/schedule-view";
import ScheduleCard from "./schedule-card";

/**
 * SCH-11 for managers: a "Filtrar por grado" select (default: the first course, kept in the URL
 * as `?courseId=`) over the course grid. Removing a class needs `schedule:update`.
 */
export default function ManagerSchedule({
  courseId,
  onCourseChange,
}: {
  courseId: string | undefined;
  onCourseChange: (courseId: string) => void;
}) {
  const canRemove = useCan("schedule:update").can;
  const canGenerate = useCan("schedule:generate").can;
  const removal = useRemoveSlot();
  const coursesQuery = useQuery(orpc.course.options.queryOptions({ input: {} }));
  const selected = coursesQuery.data ? resolveCourseId(coursesQuery.data, courseId) : undefined;
  const scheduleQuery = useQuery({
    ...orpc.schedule.get.queryOptions({ input: { view: "course", courseId: selected } }),
    enabled: selected !== undefined,
  });

  if (coursesQuery.isPending) {
    return <Loader />;
  }
  if (coursesQuery.isError) {
    return (
      <LoadError
        message="No se pudieron cargar los grados."
        onRetry={() => void coursesQuery.refetch()}
      />
    );
  }
  const courses = coursesQuery.data;
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock />}
        title="No hay grados registrados"
        description="Crea grados y asígnales materias para generar horarios."
      />
    );
  }
  if (scheduleQuery.isError) {
    return (
      <LoadError
        message="No se pudo cargar el horario."
        onRetry={() => void scheduleQuery.refetch()}
      />
    );
  }
  if (!scheduleQuery.data) {
    return <Loader />;
  }

  return (
    <>
      <ScheduleCard
        schedule={scheduleQuery.data}
        onRemove={canRemove ? removal.requestRemove : undefined}
        emptyAction={
          canGenerate ? (
            <Link to="/horarios/generar" className={buttonVariants()}>
              Generar Horario Automático
            </Link>
          ) : undefined
        }
        filter={
          <NativeSelect
            aria-label="Filtrar por grado"
            value={selected}
            onChange={(event) => onCourseChange(event.target.value)}
          >
            {courses.map((course) => (
              <NativeSelectOption key={course.id} value={course.id}>
                {course.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      />
      <ConfirmDelete
        {...removal.dialog}
        title={REMOVE_SLOT_QUESTION}
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}
