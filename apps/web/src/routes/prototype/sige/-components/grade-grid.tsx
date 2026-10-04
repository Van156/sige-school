import { Input } from "@base-template/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";
import { Eye } from "lucide-react";

import { IconLink } from "./icon-link";
import { GradeStatusBadge, ScoreBadge } from "./score-badge";
import { MAX_GRADE, MIN_GRADE, average, finalScore, round } from "../-mock";
import type { GradeCriteria, GradeRecord } from "../-mock/types";

/** Raw text of the cells being edited, keyed by `studentId:criterionId`. */
export type Draft = Record<string, { score: string; observation: string }>;

export const cellKey = (studentId: number, criterionId: number) => `${studentId}:${criterionId}`;

/** Parses a typed score: empty is "no grade", out of range or non-numeric is invalid. */
export function parseScore(text: string): { value: number | null; valid: boolean } {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null, valid: true };
  const value = Number(trimmed.replace(",", "."));
  const valid = Number.isFinite(value) && value >= MIN_GRADE && value <= MAX_GRADE;
  return { value: valid ? round(value, 1) : null, valid };
}

export function draftFromRecords(records: readonly GradeRecord[]): Draft {
  return Object.fromEntries(
    records.map((record) => [
      cellKey(record.studentId, record.criterionId),
      { score: record.score.toFixed(1), observation: record.observation ?? "" },
    ]),
  );
}

/** True when the typed cells differ from the saved ones (drives the "sin guardar" badge and the leave warning). */
export function isDraftDirty(draft: Draft, saved: Draft): boolean {
  const keys = new Set([...Object.keys(draft), ...Object.keys(saved)]);
  return [...keys].some((key) => {
    const typed = draft[key] ?? { score: "", observation: "" };
    const stored = saved[key] ?? { score: "", observation: "" };
    return (
      parseScore(typed.score).value !== parseScore(stored.score).value ||
      typed.observation.trim() !== stored.observation.trim()
    );
  });
}

export interface GridStudent {
  id: number;
  name: string;
  document: string;
}

/** Scores of one student that are filled and valid, ready for the weighted final. */
function scoresOf(draft: Draft, studentId: number, criteria: readonly GradeCriteria[]) {
  return criteria.flatMap((criterion) => {
    const { value } = parseScore(draft[cellKey(studentId, criterion.id)]?.score ?? "");
    return value === null ? [] : [{ criterionId: criterion.id, score: value }];
  });
}

/** Live final of a student from the draft (re-normalised when not every criterion has a score). */
export function draftFinal(draft: Draft, studentId: number, criteria: readonly GradeCriteria[]) {
  return finalScore(scoresOf(draft, studentId, criteria), criteria);
}

/**
 * Grade sheet: one row per student, a "Nota" and "Observ." column per criterion, the live weighted
 * final and its status, plus group averages in the footer. Presentational: the screen owns the
 * draft and the lock state.
 */
export function GradeGrid({
  students,
  criteria,
  draft,
  locked,
  onChange,
}: {
  students: readonly GridStudent[];
  criteria: readonly GradeCriteria[];
  draft: Draft;
  locked: boolean;
  onChange: (
    studentId: number,
    criterionId: number,
    patch: { score?: string; observation?: string },
  ) => void;
}) {
  const finals = students.map((student) => draftFinal(draft, student.id, criteria));
  const criterionAverage = (criterionId: number) =>
    average(
      students.flatMap((student) => {
        const { value } = parseScore(draft[cellKey(student.id, criterionId)]?.score ?? "");
        return value === null ? [] : [value];
      }),
    );
  const finalAverage = average(finals.flatMap((final) => (final === null ? [] : [final])));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead rowSpan={2} className="w-10">
              #
            </TableHead>
            <TableHead rowSpan={2} className="min-w-44">
              Estudiante
            </TableHead>
            {criteria.map((criterion) => (
              <TableHead key={criterion.id} colSpan={2} className="border-l text-center">
                {criterion.name} ({criterion.weight}%)
              </TableHead>
            ))}
            <TableHead rowSpan={2} className="border-l text-center">
              Final
            </TableHead>
            <TableHead rowSpan={2} className="text-center">
              Estado
            </TableHead>
            <TableHead rowSpan={2} className="w-10">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
          <TableRow className="hover:bg-transparent">
            {criteria.flatMap((criterion) => [
              <TableHead key={`${criterion.id}-score`} className="border-l text-center">
                Nota
              </TableHead>,
              <TableHead key={`${criterion.id}-note`}>Observ.</TableHead>,
            ])}
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student, index) => (
            <TableRow key={student.id}>
              <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{student.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {student.document}
                  </span>
                </div>
              </TableCell>
              {criteria.flatMap((criterion) => {
                const cell = draft[cellKey(student.id, criterion.id)] ?? {
                  score: "",
                  observation: "",
                };
                const parsed = parseScore(cell.score);
                return [
                  <TableCell key={`${criterion.id}-score`} className="border-l text-center">
                    {locked ? (
                      <ScoreBadge score={parsed.value} />
                    ) : (
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={MIN_GRADE}
                        max={MAX_GRADE}
                        step={0.1}
                        value={cell.score}
                        aria-label={`${criterion.name} de ${student.name}`}
                        aria-invalid={!parsed.valid}
                        className={cn(
                          "mx-auto h-7 w-16 px-1.5 text-right tabular-nums md:text-[13px]",
                          parsed.valid && parsed.value !== null && "border-success/60",
                        )}
                        onChange={(event) =>
                          onChange(student.id, criterion.id, { score: event.target.value })
                        }
                        onBlur={() => {
                          if (parsed.valid && parsed.value !== null) {
                            onChange(student.id, criterion.id, {
                              score: parsed.value.toFixed(1),
                            });
                          }
                        }}
                      />
                    )}
                  </TableCell>,
                  <TableCell key={`${criterion.id}-note`}>
                    {locked ? (
                      <span className="text-xs text-muted-foreground">
                        {cell.observation ? truncated(cell.observation) : "-"}
                      </span>
                    ) : (
                      <Input
                        value={cell.observation}
                        maxLength={500}
                        placeholder="Observación"
                        aria-label={`Observación de ${criterion.name} de ${student.name}`}
                        className="h-7 w-32 px-1.5 text-xs md:text-xs"
                        onChange={(event) =>
                          onChange(student.id, criterion.id, { observation: event.target.value })
                        }
                      />
                    )}
                  </TableCell>,
                ];
              })}
              <TableCell className="border-l text-center">
                <ScoreBadge score={finals[index]} decimals={2} />
              </TableCell>
              <TableCell className="text-center">
                <GradeStatusBadge score={finals[index]} />
              </TableCell>
              <TableCell>
                <IconLink
                  screenId="GRD-08"
                  search={{ student: String(student.id) }}
                  label={`Ver notas de ${student.name}`}
                >
                  <Eye />
                </IconLink>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Promedio del Grupo
            </TableCell>
            {criteria.flatMap((criterion) => {
              const mean = criterionAverage(criterion.id);
              return [
                <TableCell key={`${criterion.id}-avg`} className="border-l text-center">
                  <ScoreBadge score={mean} />
                </TableCell>,
                <TableCell key={`${criterion.id}-empty`} />,
              ];
            })}
            <TableCell className="border-l text-center">
              <ScoreBadge score={finalAverage} decimals={2} />
            </TableCell>
            <TableCell className="text-center text-muted-foreground">-</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function truncated(value: string): string {
  return value.length > 20 ? `${value.slice(0, 20)}...` : value;
}
