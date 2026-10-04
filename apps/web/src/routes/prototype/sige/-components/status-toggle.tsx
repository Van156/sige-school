import { Button } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";

import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES } from "../-lib/class-stats";
import type { AttendanceStatus } from "../-mock/types";

const GLYPH: Record<AttendanceStatus, string> = {
  presente: "✓",
  ausente: "✗",
  justificado: "⚑",
  excusado: "ℹ",
};

const ACTIVE_CLASS: Record<AttendanceStatus, string> = {
  presente: "border-success/60 bg-success/15 text-success hover:bg-success/20",
  ausente: "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/15",
  justificado: "border-info/60 bg-info/15 text-info hover:bg-info/20",
  excusado: "border-warning/70 bg-warning/20 text-foreground hover:bg-warning/30",
};

/** Four exclusive attendance buttons of a roll-sheet row (exactly one is pressed). */
export function StatusToggle({
  value,
  onValueChange,
  studentName,
  disabled,
}: {
  value: AttendanceStatus;
  onValueChange: (status: AttendanceStatus) => void;
  studentName: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={`Asistencia de ${studentName}`} className="flex flex-wrap gap-1">
      {ATTENDANCE_STATUSES.map((status) => (
        <Button
          key={status}
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled}
          aria-pressed={value === status}
          className={cn(value === status && ACTIVE_CLASS[status])}
          onClick={() => onValueChange(status)}
        >
          <span aria-hidden="true">{GLYPH[status]}</span>
          {ATTENDANCE_LABEL[status]}
        </Button>
      ))}
    </div>
  );
}
