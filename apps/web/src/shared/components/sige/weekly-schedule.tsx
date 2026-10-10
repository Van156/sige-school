import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";
import { X } from "lucide-react";

import type { SlotCell, WeeklyScheduleRow } from "@base-template/sige-core";

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;

/**
 * Monday-Friday timetable grid (sige/04 SCH-11): one row per time block, breaks flagged
 * "Descanso". The rows come from `schedule.get` (`WeeklySchedule`), already shaped by
 * `buildScheduleRows`. `showCourse` adds the course badge (teacher view); with `onRemove` every
 * class gets a small "x" (managers). Scrolls horizontally inside its own frame and prints flat.
 */
export default function WeeklySchedule({
  rows,
  showCourse = false,
  onRemove,
}: {
  rows: readonly WeeklyScheduleRow[];
  showCourse?: boolean;
  onRemove?: (cell: SlotCell) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border print:overflow-visible print:border-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Hora</TableHead>
            {WEEKDAYS.map((day) => (
              <TableHead key={day}>{day}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.time} className={cn(row.isBreak && "bg-muted/40")}>
              <TableCell className="align-top">
                <div className="flex flex-col items-start gap-1">
                  <span>{row.time}</span>
                  {row.isBreak ? <Badge variant="secondary">Descanso</Badge> : null}
                </div>
              </TableCell>
              {WEEKDAYS.map((day, index) => {
                const cell = row.cells[index] ?? null;
                return (
                  <TableCell key={day} className="min-w-32 align-top whitespace-normal">
                    {cell ? (
                      <ClassCell cell={cell} showCourse={showCourse} onRemove={onRemove} />
                    ) : (
                      <span className="text-muted-foreground">{row.isBreak ? "--" : "-"}</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClassCell({
  cell,
  showCourse,
  onRemove,
}: {
  cell: SlotCell;
  showCourse: boolean;
  onRemove?: (cell: SlotCell) => void;
}) {
  const details = [cell.teacherName, cell.classroomName].filter(Boolean).join(" · ");
  return (
    <div className="flex items-start justify-between gap-1">
      <div className="flex flex-col items-start leading-tight">
        <span className="font-medium">{cell.subjectName}</span>
        <span className="text-xs text-muted-foreground">{details}</span>
        {showCourse ? (
          <Badge variant="outline" className="mt-1">
            {cell.courseName}
          </Badge>
        ) : null}
      </div>
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="print:hidden"
          aria-label={`Quitar ${cell.subjectName} del horario`}
          onClick={() => onRemove(cell)}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
