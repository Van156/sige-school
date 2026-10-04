import { Badge } from "@base-template/ui/components/badge";
import { CheckCircle2, ClipboardList, Gauge, XCircle } from "lucide-react";

import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { ScopedPage } from "../../-components/scoped-page";
import { GradeScaleLegend, GradeStatusBadge, ScoreBadge } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { NoStudentBlock, StudentStrip, StudentSwitcher } from "../../-components/student-strip";
import { LevelBadge } from "../../-components/tone-badge";
import { formatDate, formatScore } from "../../-lib/format";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useStudentScope, type StudentScope } from "../../-lib/use-student-scope";
import { PASSING_GRADE, average, performanceLevel } from "../../-mock";
import type { AcademicPeriod, AcademicStudent, Institution } from "../../-mock/types";
import type { SubjectGradeRecord } from "../../-mock";

/** GRD-08: grades of one student by period (`?student=`; students and parents see only their own). */
export function StudentGradesScreen() {
  return (
    <ScopedPage
      screenId="GRD-08"
      title="Notas del Estudiante"
      description="Calificaciones por periodo, criterio y asignatura"
      target="Notas"
      banner={false}
    >
      {(institution) => <StudentGradesView institution={institution} />}
    </ScopedPage>
  );
}

function StudentGradesView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const scope = useStudentScope(school);
  const { selected } = scope;

  return (
    <>
      <StudentSwitcher screenId="GRD-08" scope={scope} school={school} />
      {selected ? (
        <Grades student={selected} school={school} grading={grading} scope={scope} />
      ) : (
        <NoStudentBlock scope={scope} />
      )}
    </>
  );
}

interface SubjectRow {
  item: SubjectGradeRecord;
  name: string;
  final: number | null;
}

function Grades({
  student,
  school,
  grading,
  scope,
}: {
  student: AcademicStudent;
  school: School;
  grading: Grading;
  scope: StudentScope;
}) {
  const classes = school.subjectGrades.filter((item) => item.gradeId === student.gradeId);
  const allFinals = grading.periods.flatMap((period) =>
    classes.flatMap((item) => {
      const score = grading.finalOf(student.id, item.id, period.id);
      return score === null ? [] : [score];
    }),
  );
  const periodsWithGrades = grading.periods.filter((period) =>
    classes.some((item) => grading.finalOf(student.id, item.id, period.id) !== null),
  );
  const totalRecords = grading.records.filter((record) => record.studentId === student.id).length;

  return (
    <>
      <StudentStrip
        student={student}
        school={school}
        actions={
          scope.mode === "staff" ? (
            <BackButton
              screenId="STU-02"
              search={{ id: String(student.id) }}
              label="Volver al Perfil"
            />
          ) : undefined
        }
      />

      {allFinals.length > 0 ? (
        <StatGrid>
          <StatTile
            label="Promedio General"
            value={formatScore(average(allFinals) ?? 0, 1)}
            icon={Gauge}
          />
          <StatTile
            label="Asignaturas Ganadas"
            value={allFinals.filter((score) => score >= PASSING_GRADE).length}
            icon={CheckCircle2}
            tone="success"
          />
          <StatTile
            label="Asignaturas Perdidas"
            value={allFinals.filter((score) => score < PASSING_GRADE).length}
            icon={XCircle}
            tone="destructive"
          />
          <StatTile label="Total Calificaciones" value={totalRecords} icon={ClipboardList} />
        </StatGrid>
      ) : null}

      {periodsWithGrades.length === 0 ? (
        <EmptyBlock
          title="No hay notas registradas"
          description="No hay notas registradas para este estudiante aún."
        />
      ) : (
        periodsWithGrades.map((period) => (
          <PeriodCard
            key={period.id}
            period={period}
            student={student}
            classes={classes}
            school={school}
            grading={grading}
          />
        ))
      )}

      <GradeScaleLegend />
    </>
  );
}

function PeriodCard({
  period,
  student,
  classes,
  school,
  grading,
}: {
  period: AcademicPeriod;
  student: AcademicStudent;
  classes: readonly SubjectGradeRecord[];
  school: School;
  grading: Grading;
}) {
  const rows: SubjectRow[] = classes.map((item) => ({
    item,
    name: school.subjectName(item.subjectId),
    final: grading.finalOf(student.id, item.id, period.id),
  }));
  const scoreOf = (item: SubjectGradeRecord, criterionId: number) =>
    grading
      .recordsOf(student.id, item.id, period.id)
      .find((record) => record.criterionId === criterionId)?.score;

  const columns: TableColumn<SubjectRow>[] = [
    {
      key: "subject",
      header: "Asignatura",
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{row.name}</span>
          <span className="text-xs text-muted-foreground">
            {school.gradeName(row.item.gradeId)}
          </span>
        </div>
      ),
    },
    ...grading.criteria.map((criterion): TableColumn<SubjectRow> => ({
      key: `criterion-${criterion.id}`,
      header: `${criterion.name} (${criterion.weight}%)`,
      align: "center",
      cell: (row) => <ScoreBadge score={scoreOf(row.item, criterion.id)} />,
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
      cell: (row) => <GradeStatusBadge score={row.final} />,
    },
    {
      key: "level",
      header: "Nivel de Desempeño",
      cell: (row) =>
        row.final === null ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <LevelBadge level={performanceLevel(row.final)} />
        ),
    },
  ];

  return (
    <SectionCard
      title={period.name}
      description={`${formatDate(period.startDate)} – ${formatDate(period.endDate)}`}
      action={period.isActive ? <Badge variant="info">Activo</Badge> : undefined}
    >
      <SimpleTable columns={columns} rows={rows} getRowId={(row) => row.item.id} />
    </SectionCard>
  );
}
