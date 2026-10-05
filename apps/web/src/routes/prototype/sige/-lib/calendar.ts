import { addDays, weekdayIndex } from "../-mock";
import type { Attendance } from "../-mock/types";

const monthTitleFormat = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `2026-10` shifted by `delta` months (`2026-09`, `2027-01`...). */
export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (number - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** `2026-10` -> `octubre de 2026`. */
export function monthTitle(month: string): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return monthTitleFormat.format(new Date(Date.UTC(year, number - 1, 1)));
}

export const WEEKDAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/** Month grid cells, Monday first: `null` pads the days before the 1st. */
export function calendarCells(month: string): Array<string | null> {
  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  const days: string[] = [];
  for (let day = first; day < next; day = addDays(day, 1)) days.push(day);
  return [...Array.from({ length: weekdayIndex(first) }, () => null), ...days];
}

export type DayStatus = "presente" | "ausente" | "justificado";

/** One status per calendar day: any absence wins, then any justification, otherwise present. */
export function dayStatus(rows: readonly Pick<Attendance, "status">[]): DayStatus | undefined {
  if (rows.length === 0) return undefined;
  if (rows.some((row) => row.status === "ausente")) return "ausente";
  if (rows.some((row) => row.status === "justificado" || row.status === "excusado")) {
    return "justificado";
  }
  return "presente";
}
