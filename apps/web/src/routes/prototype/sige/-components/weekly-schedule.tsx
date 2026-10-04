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

import type { ScheduleRow } from "../-mock";

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;

/**
 * Monday-Friday timetable grid: one row per time block, breaks flagged "Descanso". Cells that carry
 * a `course` show it as a badge; with `onRemove` each class gets a small "x" (managers of SCH-11).
 */
export function WeeklySchedule({
  rows,
  onRemove,
}: {
  rows: readonly ScheduleRow[];
  onRemove?: (scheduleId: number) => void;
}) {
  return (
    <div className="rounded-lg border">
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
            <TableRow key={row.blockId} className={cn(row.isBreak && "bg-muted/40")}>
              <TableCell className="align-top">
                <div className="flex flex-col items-start gap-1">
                  <span>{row.label}</span>
                  {row.isBreak ? <Badge variant="secondary">Descanso</Badge> : null}
                </div>
              </TableCell>
              {row.cells.map((cell, index) => (
                <TableCell key={WEEKDAYS[index]} className="min-w-32 align-top whitespace-normal">
                  {cell ? (
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex flex-col items-start leading-tight">
                        <span className="font-medium">{cell.subject}</span>
                        <span className="text-xs text-muted-foreground">
                          {cell.teacher} · {cell.classroom}
                        </span>
                        {cell.course ? (
                          <Badge variant="outline" className="mt-1">
                            {cell.course}
                          </Badge>
                        ) : null}
                      </div>
                      {onRemove && cell.scheduleId !== undefined ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Quitar ${cell.subject} del horario`}
                          onClick={() => onRemove(cell.scheduleId as number)}
                        >
                          <X />
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{row.isBreak ? "--" : "-"}</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
