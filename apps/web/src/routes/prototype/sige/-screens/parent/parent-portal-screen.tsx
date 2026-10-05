import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import { Badge } from "@base-template/ui/components/badge";
import { Card } from "@base-template/ui/components/card";
import { HeartHandshake } from "lucide-react";

import { EmptyBlock } from "../../-components/empty-block";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { GradeStatusBadge, ScoreBadge } from "../../-components/score-badge";
import { formatPercent, formatScore } from "../../-lib/format";
import { truncate } from "../../-lib/list";
import { OBSERVATION_LABEL, requiresNotification } from "../../-lib/observations";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useSchool, type School } from "../../-lib/use-school";
import { useStudentScope } from "../../-lib/use-student-scope";
import {
  REFERENCE_DATE,
  addDays,
  attendancePercentage,
  average,
  observationStore,
  useMockCollection,
} from "../../-mock";
import type { AcademicStudent, Institution } from "../../-mock/types";

const LINKS = [
  { screenId: "PAR-02", label: "Ver Notas" },
  { screenId: "PAR-03", label: "Asistencia" },
  { screenId: "PAR-04", label: "Observaciones" },
  { screenId: "PAR-05", label: "Boletines" },
  { screenId: "PAR-06", label: "Logros" },
] as const;

/** PAR-01: one card per linked child with average, 30-day attendance, alerts and latest grades. */
export function ParentPortalScreen() {
  return (
    <ScopedPage
      screenId="PAR-01"
      title="Portal de Acudientes"
      description="Seguimiento académico de tus hijos"
      target="Portal de Acudientes"
      banner={false}
    >
      {(institution) => <Portal institution={institution} />}
    </ScopedPage>
  );
}

function Portal({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const scope = useStudentScope(school);

  if (scope.allowed.length === 0) {
    return (
      <EmptyBlock
        icon={<HeartHandshake />}
        title="No hay estudiantes asignados"
        description="Contacta al administrador para vincular a tus hijos."
      />
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {scope.allowed.map((student) => (
        <ChildCard key={student.id} student={student} school={school} grading={grading} />
      ))}
    </div>
  );
}

interface GradeRow {
  subjectGradeId: number;
  subject: string;
  score: number | null;
}

function ChildCard({
  student,
  school,
  grading,
}: {
  student: AcademicStudent;
  school: School;
  grading: Grading;
}) {
  const observations = useMockCollection(observationStore);
  const name = school.studentName(student.id);
  const user = school.userOfStudent(student);
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "?";
  const classes = school.subjectGrades.filter((item) => item.gradeId === student.gradeId);

  // Latest period in which the child already has grades ("periodo actual" of the legacy card).
  const period = grading.periods
    .toReversed()
    .find((entry) =>
      classes.some((item) => grading.finalOf(student.id, item.id, entry.id) !== null),
    );
  const rows: GradeRow[] = classes.map((item) => ({
    subjectGradeId: item.id,
    subject: school.subjectName(item.subjectId),
    score: period ? grading.finalOf(student.id, item.id, period.id) : null,
  }));
  const allFinals = grading.periods.flatMap((entry) =>
    classes.flatMap((item) => {
      const score = grading.finalOf(student.id, item.id, entry.id);
      return score === null ? [] : [score];
    }),
  );
  const overall = average(allFinals);

  const since = addDays(REFERENCE_DATE, -30);
  const attendance = attendancePercentage(
    grading.attendance.filter(
      (row) => row.studentId === student.id && row.date >= since && row.date <= REFERENCE_DATE,
    ),
  );
  const alertsOf = observations
    .filter((row) => row.studentId === student.id && requiresNotification(row.type))
    .toSorted((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const search = { student: String(student.id) };

  const columns: TableColumn<GradeRow>[] = [
    { key: "subject", header: "Materia", cell: (row) => row.subject },
    {
      key: "score",
      header: "Nota",
      align: "center",
      cell: (row) => <ScoreBadge score={row.score} />,
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      cell: (row) => <GradeStatusBadge score={row.score} />,
    },
  ];

  return (
    <Card size="sm" className="gap-3">
      <div className="flex flex-col gap-4 px-(--card-spacing)">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base font-semibold">{name}</span>
            <span className="text-[13px] text-muted-foreground">
              {school.gradeName(student.gradeId) ?? "Sin grado"} ·{" "}
              {school.campusName(student.campusId)}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-center">
          <div className="flex flex-col rounded-md bg-muted/50 px-2 py-2">
            <dd className="text-xl font-semibold tabular-nums">
              {overall === null ? "N/A" : formatScore(overall, 1)}
            </dd>
            <dt className="text-xs text-muted-foreground">Promedio General</dt>
          </div>
          <div className="flex flex-col rounded-md bg-muted/50 px-2 py-2">
            <dd className="text-xl font-semibold tabular-nums">{formatPercent(attendance, 0)}</dd>
            <dt className="text-xs text-muted-foreground">Asistencia (30 días)</dt>
          </div>
        </dl>

        {alertsOf.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-warning/60 bg-warning/10 p-2.5">
            <h3 className="text-[13px] font-medium">Alertas Activas</h3>
            <ul className="flex flex-col gap-1 text-[13px]">
              {alertsOf.map((row) => (
                <li key={row.id}>
                  <Badge variant="outline">{OBSERVATION_LABEL[row.type]}</Badge>{" "}
                  <span className="text-muted-foreground">{truncate(row.description, 60)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {LINKS.map((link) => (
            <ScreenLinkButton
              key={link.screenId}
              screenId={link.screenId}
              search={search}
              size="sm"
            >
              {link.label}
            </ScreenLinkButton>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-[13px] font-medium">
            Últimas Notas{period ? ` - ${period.name}` : ""}
          </h3>
          <SimpleTable
            columns={columns}
            rows={rows}
            getRowId={(row) => row.subjectGradeId}
            empty={
              <p className="text-[13px] text-muted-foreground">No hay notas registradas aún.</p>
            }
          />
        </div>
      </div>
    </Card>
  );
}
