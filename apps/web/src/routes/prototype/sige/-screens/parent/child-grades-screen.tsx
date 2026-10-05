import { Badge } from "@base-template/ui/components/badge";
import { ArrowDown, ArrowRight, ArrowUp, Gauge, ListChecks } from "lucide-react";

import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { ParentChildPage, type ChildContext } from "../../-components/parent-frame";
import { GradeScaleLegend, ScoreBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { formatScore } from "../../-lib/format";
import { PASSING_GRADE, average } from "../../-mock";

interface SubjectRow {
  id: number;
  subject: string;
  scores: Array<number | null>;
}

/** PAR-02: the child's finals per subject and period, with trend arrows. */
export function ChildGradesScreen() {
  return (
    <ParentChildPage screenId="PAR-02" title="Notas del hijo/a" section="Notas">
      {(context) => <Grades {...context} />}
    </ParentChildPage>
  );
}

function Trend({ now, before }: { now: number | null; before: number | null | undefined }) {
  if (now === null || before === null || before === undefined) return null;
  if (now > before) return <ArrowUp className="size-3.5 text-success" aria-label="Sube" />;
  if (now < before) return <ArrowDown className="size-3.5 text-destructive" aria-label="Baja" />;
  return <ArrowRight className="size-3.5 text-muted-foreground" aria-label="Igual" />;
}

function Grades({ student, school, grading }: ChildContext) {
  const classes = school.subjectGrades.filter((item) => item.gradeId === student.gradeId);
  const rows: SubjectRow[] = classes.map((item) => ({
    id: item.id,
    subject: school.subjectName(item.subjectId),
    scores: grading.periods.map((period) => grading.finalOf(student.id, item.id, period.id)),
  }));
  const allScores = rows.flatMap((row) => row.scores.filter((score) => score !== null));
  const overall = average(allScores);
  const lastKnown = (row: SubjectRow) =>
    row.scores.filter((score) => score !== null).at(-1) ?? null;

  const columns: TableColumn<SubjectRow>[] = [
    {
      key: "subject",
      header: "Materia",
      sortValue: (row) => row.subject,
      cell: (row) => <span className="font-medium">{row.subject}</span>,
    },
    ...grading.periods.map((period, index): TableColumn<SubjectRow> => ({
      key: `period-${period.id}`,
      header: period.shortName,
      align: "center",
      cell: (row) => {
        const score = row.scores[index] ?? null;
        return (
          <span className="inline-flex items-center gap-1">
            <ScoreBadge score={score} />
            <Trend now={score} before={index > 0 ? row.scores[index - 1] : undefined} />
          </span>
        );
      },
    })),
    {
      key: "status",
      header: "Estado",
      align: "center",
      cell: (row) => {
        const last = lastKnown(row);
        if (last === null) return <Badge variant="secondary">Sin notas</Badge>;
        return last >= PASSING_GRADE ? (
          <Badge variant="success">Aprobado</Badge>
        ) : (
          <Badge variant="destructive">Reprobado</Badge>
        );
      },
    },
  ];

  return (
    <>
      <StatGrid columns={3}>
        <StatTile
          label="Promedio General"
          value={overall === null ? "-" : formatScore(overall)}
          icon={Gauge}
          hint={
            overall === null ? "Sin notas" : overall >= PASSING_GRADE ? "Aprobado" : "Reprobado"
          }
          tone={overall !== null && overall < PASSING_GRADE ? "destructive" : "success"}
        />
        <div className="flex items-center sm:col-span-2">
          <ScreenLinkButton screenId="GRD-08" search={{ student: String(student.id) }}>
            <ListChecks data-icon="inline-start" />
            Detalle por criterio
          </ScreenLinkButton>
        </div>
      </StatGrid>
      <GradeScaleLegend />
      <SectionCard title="Calificaciones por Periodo">
        <SimpleTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          empty={
            <EmptyBlock
              title="No hay notas registradas"
              description="Las notas aparecerán cuando los profesores las registren."
            />
          }
        />
      </SectionCard>
    </>
  );
}
