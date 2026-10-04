import type { Attendance, ObservationType, PerformanceLevel, Severity } from "../-mock/types";
import type { BadgeTone } from "./roles";
import type { ScoreClass } from "../-mock/helpers";

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** `2026-10-05` -> `05 oct 2026`. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return dateFormat.format(new Date(Date.UTC(year as number, (month as number) - 1, day)));
}

/** `2026-10-05T09:30` -> `05 oct 2026, 09:30`. */
export function formatDateTime(iso: string): string {
  const [datePart, timePart = "00:00"] = iso.split("T");
  const [year, month, day] = (datePart as string).split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return dateTimeFormat.format(
    new Date(Date.UTC(year as number, (month as number) - 1, day, hour, minute)),
  );
}

export function formatScore(score: number, decimals = 2): string {
  return score.toFixed(decimals);
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export const SCORE_TONE: Record<ScoreClass, BadgeTone> = {
  excellent: "success",
  good: "info",
  passing: "warning",
  risk: "destructive",
  critical: "destructive",
};

export const LEVEL_TONE: Record<PerformanceLevel, BadgeTone> = {
  Superior: "success",
  Alto: "info",
  Básico: "warning",
  Bajo: "destructive",
};

export const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  alta: "destructive",
  media: "warning",
  baja: "success",
};

export const ATTENDANCE_TONE: Record<Attendance["status"], BadgeTone> = {
  presente: "success",
  ausente: "destructive",
  justificado: "info",
  excusado: "warning",
};

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const OBSERVATION_TONE: Record<ObservationType, BadgeTone> = {
  positiva: "success",
  negativa: "destructive",
  seguimiento: "info",
  convivencia: "warning",
};
