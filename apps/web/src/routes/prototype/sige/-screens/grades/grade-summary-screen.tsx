import { TableCell, TableRow } from "@base-template/ui/components/table";
import { BarChart3, CheckCircle2, Gauge, Users } from "lucide-react";

import { CategoryBarChart } from "../../-components/charts";
import { ClassContext, type ClassInfo } from "../../-components/class-context";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { GradeStatusBadge, ScoreBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { StudentLink } from "../../-components/student-link";
import { scoreDistribution, standardDeviation } from "../../-lib/class-stats";
import { formatPercent, formatScore } from "../../-lib/format";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import { PASSING_GRADE, average, percent, round } from "../../-mock";
import type { AcademicPeriod, Institution } from "../../-mock/types";

interface SummaryRow {
  index: number;
  studentId: number;
  name: string;
  final: number | null;
}

/** GRD-07: grade analytics of one subject-grade and period (`?sg=&period=`). */
export function GradeSummaryScreen() {
  const subjectGrade = useIntParam("sg");
  const period = useIntParam("period");
  return (
    <ScopedPage
      screenId="GRD-07"
      title="Resumen de Notas"
      description="Promedios, aprobación y distribución del grupo"
      target="Notas"
      banner={false}
      back={
        <BackButton
          screenId="GRD-02"
          label="Volver a Planilla"
          search={{
            sg: subjectGrade === undefined ? undefined : String(subjectGrade),
            period: period === undefined ? undefined : String(period),
          }}
        />
      }
    >
      {(institution) => <SummaryView institution={institution} />}
    </ScopedPage>
  );
}

function SummaryView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  return (
    <ClassContext school={school} grading={grading} selectScreenId="GRD-01">
      {(info) =>
        info.period ? (
          <Summary info={info} period={info.period} school={school} grading={grading} />
        ) : null
      }
    </ClassContext>
  );
}

function Summary({
  info,
  period,
  school,
  grading,
}: {
  info: ClassInfo;
  period: AcademicPeriod;
  school: School;
  grading: Grading;
}) {
  const search = { sg: String(info.subjectGrade.id), period: String(period.id) };

  if (info.students.length === 0) {
    return (
      <EmptyBlock
        title="No hay estudiantes en este grado"
        action={<ScreenLinkButton screenId="INS-11">Administrar Grados</ScreenLinkButton>}
      />
    );
  }

  const rows: SummaryRow[] = info.students.map((student, index) => ({
    index: index + 1,
    studentId: student.id,
    name: school.userName(student.userId) ?? "Estudiante",
    final: grading.finalOf(student.id, info.subjectGrade.id, period.id),
  }));
  const finals = rows.flatMap((row) => (row.final === null ? [] : [row.final]));

  if (finals.length === 0) {
    return (
      <EmptyBlock
        icon={<BarChart3 />}
        title="No hay calificaciones registradas"
        description="Aún no se han ingresado notas para este grupo en el periodo."
        action={
          <ScreenLinkButton screenId="GRD-02" search={search} variant="default">
            Ir a la Planilla de Notas
          </ScreenLinkButton>
        }
      />
    );
  }

  const mean = average(finals) ?? 0;
  const passed = finals.filter((score) => score >= PASSING_GRADE).length;
  const failed = finals.length - passed;
  const notEvaluated = rows.length - finals.length;
  const passRate = percent(passed, finals.length);
  const deviation = standardDeviation(finals);

  const scoreOf = (studentId: number, criterionId: number) =>
    grading
      .recordsOf(studentId, info.subjectGrade.id, period.id)
      .find((record) => record.criterionId === criterionId)?.score;
  const criterionStats = grading.criteria.map((criterion) => {
    const scores = rows.flatMap((row) => {
      const score = scoreOf(row.studentId, criterion.id);
      return score === undefined ? [] : [score];
    });
    return { criterion, mean: average(scores), count: scores.length };
  });

  const columns: TableColumn<SummaryRow>[] = [
    {
      key: "index",
      header: "#",
      className: "w-10 text-muted-foreground",
      cell: (row) => row.index,
    },
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => row.name,
      cell: (row) => (
        <StudentLink screenId="STU-02" studentId={row.studentId}>
          {row.name}
        </StudentLink>
      ),
    },
    ...grading.criteria.map((criterion): TableColumn<SummaryRow> => ({
      key: `criterion-${criterion.id}`,
      header: criterion.name,
      align: "center",
      sortValue: (row) => scoreOf(row.studentId, criterion.id),
      cell: (row) => <ScoreBadge score={scoreOf(row.studentId, criterion.id)} />,
    })),
    {
      key: "final",
      header: "Final",
      align: "center",
      sortValue: (row) => row.final,
      cell: (row) => <ScoreBadge score={row.final} decimals={2} />,
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      sortValue: (row) => row.final,
      cell: (row) => <GradeStatusBadge score={row.final} />,
    },
  ];

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {info.subjectName} — {info.grade.name} — {period.name}
      </p>

      <StatGrid>
        <StatTile
          label="Promedio General"
          value={formatScore(mean, 1)}
          icon={Gauge}
          tone={mean >= 4 ? "success" : mean >= 3 ? "warning" : "destructive"}
          hint={mean >= 4 ? "Excelente" : mean >= 3 ? "Aceptable" : "Requiere Atención"}
        />
        <StatTile
          label="Tasa de Aprobación"
          value={formatPercent(passRate)}
          icon={CheckCircle2}
          tone={passRate >= 70 ? "success" : "destructive"}
          hint={`${passed} ganaron · ${failed} perdieron`}
        />
        <StatTile
          label="Máx / Mín"
          value={`${formatScore(Math.max(...finals), 1)} / ${formatScore(Math.min(...finals), 1)}`}
          icon={BarChart3}
          hint="Rango de notas"
        />
        <StatTile
          label="Evaluados / Total"
          value={`${finals.length} / ${rows.length}`}
          icon={Users}
          hint={`${formatPercent(percent(finals.length, rows.length))} completado`}
        />
      </StatGrid>

      <SectionCard title="Resumen por Estudiante">
        <SimpleTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.studentId}
          pageSize={15}
          footer={
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                PROMEDIOS
              </TableCell>
              {criterionStats.map(({ criterion, mean: criterionMean }) => (
                <TableCell key={criterion.id} className="text-center">
                  <ScoreBadge score={criterionMean} />
                </TableCell>
              ))}
              <TableCell className="text-center">
                <ScoreBadge score={round(mean)} decimals={2} />
              </TableCell>
              <TableCell />
            </TableRow>
          }
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Distribución de Notas" className="lg:col-span-2">
          <CategoryBarChart
            ariaLabel="Distribución de notas finales por rango"
            seriesLabel="Estudiantes"
            data={scoreDistribution(finals)}
          />
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard title="Estadísticas por Criterio">
            <ul className="flex flex-col gap-3 text-[13px]">
              {criterionStats.map(({ criterion, mean: criterionMean, count }) => (
                <li key={criterion.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{criterion.name}</span>
                    <span className="tabular-nums">
                      {criterionMean === null ? "N/A" : formatScore(criterionMean, 1)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${((criterionMean ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {count} estudiantes evaluados
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Estadísticas Rápidas">
            <dl className="grid grid-cols-3 gap-2 text-center text-[13px]">
              <div>
                <dt className="text-xs text-muted-foreground">Reprobados</dt>
                <dd className="text-lg font-semibold tabular-nums">{failed}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">No evaluados</dt>
                <dd className="text-lg font-semibold tabular-nums">{notEvaluated}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Desv. estándar</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {deviation === null ? "-" : formatScore(deviation, 1)}
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
