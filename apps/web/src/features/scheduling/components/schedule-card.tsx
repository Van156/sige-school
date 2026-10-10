import type { SlotCell, WeeklySchedule as WeeklyScheduleData } from "@base-template/sige-core";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { CalendarClock } from "lucide-react";
import type { ReactNode } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import WeeklySchedule from "@/shared/components/sige/weekly-schedule";

import { hasScheduledClasses } from "../lib/schedule-view";

/**
 * SCH-11 card (presentational): the schedule's title, an optional filter slot and the weekly grid,
 * or the "No hay horarios generados" state when no weekday holds a class.
 */
export default function ScheduleCard({
  schedule,
  showCourse = false,
  onRemove,
  filter,
  emptyAction,
}: {
  schedule: WeeklyScheduleData;
  showCourse?: boolean;
  /** Managers only: shows the per-class "x". */
  onRemove?: (cell: SlotCell) => void;
  /** Header slot, e.g. the manager's "Filtrar por grado" select. */
  filter?: ReactNode;
  /** Action of the empty state, e.g. the link to the generator. */
  emptyAction?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <CardTitle className="text-base font-semibold">{schedule.title}</CardTitle>
        {filter}
      </CardHeader>
      <CardContent>
        {hasScheduledClasses(schedule) ? (
          <WeeklySchedule rows={schedule.rows} showCourse={showCourse} onRemove={onRemove} />
        ) : (
          <EmptyState
            icon={<CalendarClock />}
            title="No hay horarios generados"
            description="Genere los horarios automáticamente o asigne manualmente."
            action={emptyAction}
          />
        )}
      </CardContent>
    </Card>
  );
}
