import { RefreshCw } from "lucide-react";

import { ClassContext, type ClassInfo } from "../../-components/class-context";
import { ClassHeader } from "../../-components/class-header";
import { ConfirmActionButton } from "../../-components/confirm-action";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { ScopedPage } from "../../-components/scoped-page";
import { GradeStatusBadge, ScoreBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StudentLink } from "../../-components/student-link";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import { average, mockAction } from "../../-mock";
import type { AcademicPeriod, Institution } from "../../-mock/types";
import { TableCell, TableRow } from "@base-template/ui/components/table";

interface FinalRow {
  index: number;
  studentId: number;
  name: string;
  final: number | null;
}

/** GRD-05: period final grades of one subject-grade (`?sg=&period=`). */
export function FinalGradesScreen() {
  const subjectGrade = useIntParam("sg");
  const period = useIntParam("period");
  return (
    <ScopedPage
      screenId="GRD-05"
      title="Notas Finales del Periodo"
      description="Nota final ponderada por estudiante"
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
      {(institution) => <FinalView institution={institution} />}
    </ScopedPage>
  );
}

function FinalView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  return (
    <ClassContext school={school} grading={grading} selectScreenId="GRD-01">
      {(info) =>
        info.period ? (
          <FinalTable info={info} period={info.period} school={school} grading={grading} />
        ) : null
      }
    </ClassContext>
  );
}

function FinalTable({
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
  const rows: FinalRow[] = info.students.map((student, index) => ({
    index: index + 1,
    studentId: student.id,
    name: school.userName(student.userId) ?? "Estudiante",
    final: grading.finalOf(student.id, info.subjectGrade.id, period.id),
  }));
  const scoreOf = (studentId: number, criterionId: number) =>
    grading
      .recordsOf(studentId, info.subjectGrade.id, period.id)
      .find((record) => record.criterionId === criterionId)?.score;
  const criterionAverage = (criterionId: number) =>
    average(
      rows.flatMap((row) => {
        const score = scoreOf(row.studentId, criterionId);
        return score === undefined ? [] : [score];
      }),
    );
  const finalAverage = average(rows.flatMap((row) => (row.final === null ? [] : [row.final])));

  const columns: TableColumn<FinalRow>[] = [
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
        <StudentLink screenId="GRD-08" studentId={row.studentId}>
          {row.name}
        </StudentLink>
      ),
    },
    ...grading.criteria.map((criterion): TableColumn<FinalRow> => ({
      key: `criterion-${criterion.id}`,
      header: `${criterion.name} (${criterion.weight}%)`,
      align: "center",
      sortValue: (row) => scoreOf(row.studentId, criterion.id),
      cell: (row) => <ScoreBadge score={scoreOf(row.studentId, criterion.id)} />,
    })),
    {
      key: "final",
      header: "Nota Final",
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
      <ClassHeader info={info} criteria={grading.criteria} />
      <SectionCard
        title="Notas Finales por Estudiante"
        description={`${period.name} · calculadas con los pesos de cada criterio`}
        action={
          <ConfirmActionButton
            title="¿Recalcular todas las notas finales?"
            description="Se vuelven a calcular las notas finales de todos los estudiantes con las notas actuales."
            confirmLabel="Recalcular"
            onConfirm={() =>
              mockAction(
                "Notas recalculadas",
                "Las notas finales siempre se derivan de la planilla.",
              )
            }
          >
            <RefreshCw data-icon="inline-start" />
            Recalcular Todas
          </ConfirmActionButton>
        }
      >
        <SimpleTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.studentId}
          pageSize={15}
          empty={<EmptyBlock title="No hay estudiantes activos en este grado." />}
          footer={
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                PROMEDIO GENERAL
              </TableCell>
              {grading.criteria.map((criterion) => (
                <TableCell key={criterion.id} className="text-center">
                  <ScoreBadge score={criterionAverage(criterion.id)} />
                </TableCell>
              ))}
              <TableCell className="text-center">
                <ScoreBadge score={finalAverage} decimals={2} />
              </TableCell>
              <TableCell />
            </TableRow>
          }
        />
      </SectionCard>
    </>
  );
}
