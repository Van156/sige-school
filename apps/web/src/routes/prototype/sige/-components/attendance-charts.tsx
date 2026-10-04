import { SeriesChart, type SeriesDef } from "./charts";
import { monthLabel, type MonthTally } from "../-lib/class-stats";

export const ATTENDANCE_SERIES: readonly SeriesDef[] = [
  { key: "present", label: "Presentes", color: "var(--success)" },
  { key: "absent", label: "Ausentes", color: "var(--destructive)" },
  { key: "justified", label: "Justificados", color: "var(--warning)" },
];

/** Presentes / Ausentes / Justificados per month, as grouped bars or lines. */
export function MonthlyAttendanceChart({
  months,
  variant,
  ariaLabel,
}: {
  months: readonly MonthTally[];
  variant: "bar" | "line";
  ariaLabel: string;
}) {
  return (
    <SeriesChart
      variant={variant}
      ariaLabel={ariaLabel}
      series={ATTENDANCE_SERIES}
      data={months.map((entry) => ({
        label: monthLabel(entry.month),
        present: entry.present,
        absent: entry.absent,
        justified: entry.justified,
      }))}
    />
  );
}
