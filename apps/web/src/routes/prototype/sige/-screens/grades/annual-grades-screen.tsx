import { TableCell, TableRow } from "@base-template/ui/components/table";

import { ClassContext, type ClassInfo } from "../../-components/class-context";
import { ClassHeader } from "../../-components/class-header";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { ScopedPage } from "../../-components/scoped-page";
import { AnnualStatusBadge, ScoreBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StudentLink } from "../../-components/student-link";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import { average } from "../../-mock";
import type { Institution } from "../../-mock/types";

interface AnnualRow {
  index: number;
  studentId: number;
  name: string;
  annual: number | null;
}

/** GRD-06: annual grades (P1..P4, DEF and annual status) of one subject-grade (`?sg=`). */
export function AnnualGradesScreen() {
  const subjectGrade = useIntParam("sg");
  return (
    <ScopedPage
      screenId="GRD-06"
      title="Notas Anuales"
      description="Nota por periodo y definitiva del año"
      target="Notas"
      banner={false}
      actions={
        <BackButton
          screenId="GRD-01"
          search={{ sg: subjectGrade === undefined ? undefined : String(subjectGrade) }}
        />
      }
    >
      {(institution) => <AnnualView institution={institution} />}
    </ScopedPage>
  );
}

function AnnualView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  return (
    <ClassContext school={school} grading={grading} selectScreenId="GRD-01" withPeriod={false}>
      {(info) => <AnnualTable info={info} school={school} grading={grading} />}
    </ClassContext>
  );
}

function AnnualTable({
  info,
  school,
  grading,
}: {
  info: ClassInfo;
  school: School;
  grading: Grading;
}) {
  const rows: AnnualRow[] = info.students.map((student, index) => ({
    index: index + 1,
    studentId: student.id,
    name: school.userName(student.userId) ?? "Estudiante",
    annual: grading.annualOf(student.id, info.subjectGrade.id),
  }));
  const periodAverage = (periodId: number) =>
    average(
      rows.flatMap((row) => {
        const score = grading.finalOf(row.studentId, info.subjectGrade.id, periodId);
        return score === null ? [] : [score];
      }),
    );
  const annualAverage = average(rows.flatMap((row) => (row.annual === null ? [] : [row.annual])));

  const columns: TableColumn<AnnualRow>[] = [
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
    ...grading.periods.map((period): TableColumn<AnnualRow> => ({
      key: `period-${period.id}`,
      header: period.shortName,
      align: "center",
      sortValue: (row) => grading.finalOf(row.studentId, info.subjectGrade.id, period.id),
      cell: (row) => (
        <ScoreBadge
          score={grading.finalOf(row.studentId, info.subjectGrade.id, period.id)}
          decimals={2}
        />
      ),
    })),
    {
      key: "annual",
      header: "DEF",
      align: "center",
      sortValue: (row) => row.annual,
      cell: (row) => <ScoreBadge score={row.annual} decimals={2} />,
    },
    {
      key: "status",
      header: "Estado Anual",
      align: "center",
      sortValue: (row) => row.annual,
      cell: (row) => <AnnualStatusBadge score={row.annual} />,
    },
  ];

  return (
    <>
      <ClassHeader info={info} />
      <SectionCard
        title="Tabla de Notas por Periodo y Definitiva"
        description="DEF es el promedio de las notas finales de los periodos disponibles."
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
              {grading.periods.map((period) => (
                <TableCell key={period.id} className="text-center">
                  <ScoreBadge score={periodAverage(period.id)} decimals={2} />
                </TableCell>
              ))}
              <TableCell className="text-center">
                <ScoreBadge score={annualAverage} decimals={2} />
              </TableCell>
              <TableCell />
            </TableRow>
          }
        />
      </SectionCard>
    </>
  );
}
