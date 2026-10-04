import { Badge } from "@base-template/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";

import type { ScheduleRow } from "../-mock";

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;

/** Monday-Friday timetable grid: one row per time block, breaks flagged "Descanso". */
export function WeeklySchedule({ rows }: { rows: readonly ScheduleRow[] }) {
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
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium">{cell.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {cell.teacher} · {cell.classroom}
                      </span>
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
