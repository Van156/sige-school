import { Badge } from "@base-template/ui/components/badge";

import { SectionCard } from "./section-card";
import { LevelBadge } from "./tone-badge";
import { ATTENDANCE_TONE, SCORE_TONE, formatPercent, formatScore } from "../-lib/format";
import { ATTENDANCE_LABEL } from "../-lib/class-stats";
import { absenceBand, annualStatusFromScore, scoreClass, statusFromScore } from "../-mock";
import type { LockState } from "../-lib/use-grading";
import type { AttendanceStatus, PerformanceLevel } from "../-mock/types";

/** Score pill coloured by the inventory 0.4 semantics (>= 4.5 green, >= 4.0 blue, >= 3.0 amber, else red). */
export function ScoreBadge({
  score,
  decimals = 1,
}: {
  score: number | null | undefined;
  decimals?: number;
}) {
  if (score === null || score === undefined)
    return <span className="text-muted-foreground">-</span>;
  return <Badge variant={SCORE_TONE[scoreClass(score)]}>{formatScore(score, decimals)}</Badge>;
}

/** "Ganada" / "Perdida" / "Sin nota" for a period final (grey when nothing was graded). */
export function GradeStatusBadge({ score }: { score: number | null | undefined }) {
  const status = statusFromScore(score);
  if (status === "ganada") return <Badge variant="success">Ganada</Badge>;
  if (status === "perdida") return <Badge variant="destructive">Perdida</Badge>;
  return <Badge variant="secondary">Sin nota</Badge>;
}

/** "Aprobado" / "Reprobado" for the annual score. */
export function AnnualStatusBadge({ score }: { score: number | null | undefined }) {
  const status = annualStatusFromScore(score);
  if (status === "aprobado") return <Badge variant="success">Aprobado</Badge>;
  if (status === "reprobado") return <Badge variant="destructive">Reprobado</Badge>;
  return <Badge variant="secondary">Sin nota</Badge>;
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge variant={ATTENDANCE_TONE[status]}>{ATTENDANCE_LABEL[status]}</Badge>;
}

/** Lock badge of a subject-grade in a period: "Cerrado" (locked), "Abierto" or "Sin datos". */
export function LockBadge({ state }: { state: LockState }) {
  if (state === "locked") return <Badge variant="destructive">Cerrado</Badge>;
  if (state === "open") return <Badge variant="success">Abierto</Badge>;
  return <Badge variant="secondary">Sin datos</Badge>;
}

const BAND_LABEL = { critical: "Crítico", attention: "Atención", normal: "Normal" } as const;
const BAND_TONE = { critical: "destructive", attention: "warning", normal: "success" } as const;

/** Absence-rate band: > 20% Crítico, > 10% Atención, otherwise Normal. */
export function AbsenceBandBadge({ rate }: { rate: number }) {
  const band = absenceBand(rate);
  return <Badge variant={BAND_TONE[band]}>{BAND_LABEL[band]}</Badge>;
}

/** Percentage with a thin proportional bar (group attendance table). */
export function RateBar({ value, tone }: { value: number; tone: "success" | "destructive" }) {
  return (
    <div className="flex min-w-24 flex-col gap-1">
      <span className="tabular-nums">{formatPercent(value, 1)}</span>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={tone === "success" ? "h-full bg-success" : "h-full bg-destructive"}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

const LEVEL_RANGE: ReadonlyArray<readonly [PerformanceLevel, string]> = [
  ["Superior", "4.6 - 5.0"],
  ["Alto", "4.0 - 4.5"],
  ["Básico", "3.0 - 3.9"],
  ["Bajo", "1.0 - 2.9"],
];

/** "Escala de Calificación" card with the four performance bands. */
export function GradeScaleLegend() {
  return (
    <SectionCard title="Escala de Calificación">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
        {LEVEL_RANGE.map(([level, range]) => (
          <li key={level} className="flex items-center gap-2">
            <LevelBadge level={level} />
            <span className="tabular-nums">{range}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Escala: 1.0 a 5.0 | Nota mínima de aprobación: 3.0
      </p>
    </SectionCard>
  );
}
