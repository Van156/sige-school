import type { WeeklySchedule as WeeklyScheduleData } from "@base-template/sige-core";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { CalendarClock, CalendarX } from "lucide-react";
import type { ReactNode } from "react";

import { hasScheduledClasses } from "@/features/scheduling";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import WeeklySchedule from "@/shared/components/sige/weekly-schedule";

/** What the "Horario" tab can show; the container maps `schedule.get` onto it. */
export type StudentScheduleState =
  | { status: "no-course" }
  | { status: "loading"; courseName: string }
  | { status: "error"; courseName: string; onRetry: () => void }
  | { status: "ready"; courseName: string; schedule: WeeklyScheduleData };

/**
 * STU-02 "Horario" tab (sige/05 §5.2): "Horario Semanal: {curso}" with the course's weekly grid,
 * the "no schedule yet" state, or the "no course" state. `fullScreenLink` renders in the card
 * header ("Ver en pantalla completa" → SCH-11). Presentational.
 */
export default function StudentScheduleTab({
  state,
  fullScreenLink,
}: {
  state: StudentScheduleState;
  fullScreenLink?: ReactNode;
}) {
  if (state.status === "no-course") {
    return (
      <EmptyState
        icon={<CalendarX />}
        title="El estudiante no está asignado a ningún curso."
        description="Asigne un curso en la pestaña de edición para ver el horario."
      />
    );
  }
  return (
    <Card size="sm">
      <CardHeader className="flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <CardTitle className="text-base font-semibold">
          Horario Semanal: {state.courseName}
        </CardTitle>
        {fullScreenLink}
      </CardHeader>
      <CardContent>
        <ScheduleBody state={state} />
      </CardContent>
    </Card>
  );
}

function ScheduleBody({
  state,
}: {
  state: Exclude<StudentScheduleState, { status: "no-course" }>;
}) {
  switch (state.status) {
    case "loading":
      return <Loader />;
    case "error":
      return <LoadError message="No se pudo cargar el horario." onRetry={state.onRetry} />;
    case "ready":
      return hasScheduledClasses(state.schedule) ? (
        <WeeklySchedule rows={state.schedule.rows} />
      ) : (
        <EmptyState
          icon={<CalendarClock />}
          title="No hay un horario generado para este curso todavía."
          description="Contacta con coordinación académica."
        />
      );
  }
}
