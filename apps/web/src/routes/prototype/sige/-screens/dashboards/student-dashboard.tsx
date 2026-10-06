import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import { Badge } from "@base-template/ui/components/badge";
import { CalendarCheck, ClipboardList, NotebookPen } from "lucide-react";

import { getInitials } from "@/shared/lib/initials";

import { ActionLink } from "../../-components/action-link";
import { CategoryBarChart } from "../../-components/charts";
import { EmptyBlock } from "../../-components/empty-block";
import { SigePageHeader } from "../../-components/page-header";
import { SectionCard } from "../../-components/section-card";
import { WeeklySchedule } from "../../-components/weekly-schedule";
import { SCORE_TONE, formatScore } from "../../-lib/format";
import { referencePeriod } from "../../-lib/metrics";
import { useMetrics } from "../../-lib/use-metrics";
import { useRole } from "../../-lib/use-role";
import { INSTITUTION_ID, currentUserFor, fullName, scoreClass } from "../../-mock";

const TONE_COLOR = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  default: "var(--chart-1)",
  secondary: "var(--chart-1)",
  outline: "var(--chart-1)",
} as const;

/** Legend entries by performance band; risk and critical share the destructive color. */
const SCORE_LEGEND = [
  {
    label: "Excelente (4.5 a 5.0)",
    color: TONE_COLOR.success,
    test: (score: number) => scoreClass(score) === "excellent",
  },
  {
    label: "Bueno (4.0 a 4.4)",
    color: TONE_COLOR.info,
    test: (score: number) => scoreClass(score) === "good",
  },
  {
    label: "Aceptable (3.0 a 3.9)",
    color: TONE_COLOR.warning,
    test: (score: number) => scoreClass(score) === "passing",
  },
  {
    label: "En riesgo (menos de 3.0)",
    color: TONE_COLOR.destructive,
    test: (score: number) => score < 3,
  },
] as const;

/** DASH-05: profile card, shortcuts, latest finals and the weekly timetable of the student's group. */
export function StudentDashboard() {
  const role = useRole();
  const user = currentUserFor(role);
  const metrics = useMetrics(INSTITUTION_ID);
  const { school, grading } = metrics;
  const student = school.students.find((entry) => entry.userId === user.id);
  const grade = student?.gradeId ? school.gradeById.get(student.gradeId) : undefined;

  if (!student) {
    return (
      <EmptyBlock
        title="Perfil académico no configurado"
        description="Contacta al administrador para que asigne tu grado y grupo."
      />
    );
  }

  const schedule = grade ? school.gradeScheduleRows(grade) : [];
  const period = referencePeriod(metrics);
  const finals = school.subjectGrades
    .filter((item) => item.gradeId === student.gradeId)
    .flatMap((item) => {
      const score = period ? grading.finalOf(student.id, item.id, period.id) : null;
      const subject = school.subjectById.get(item.subjectId);
      return score === null ? [] : [{ code: subject?.code ?? subject?.name ?? "", score }];
    });

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader title="Mi Dashboard" description={`Bienvenido/a, ${user.firstName}`} />

      <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
        <Avatar className="size-12 rounded-md">
          <AvatarFallback className="rounded-md text-sm">
            {getInitials(fullName(user))}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-semibold">{fullName(user)}</span>
          <span className="text-[13px] text-muted-foreground">
            Grado:{" "}
            <strong className="font-medium text-foreground">{grade?.name ?? "No asignado"}</strong>
          </span>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {user.documentType} {user.documentNumber}
          </span>
        </div>
        <Badge variant="info">{grade?.name ?? "Sin grado"}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ActionLink
          screenId="GRD-08"
          icon={NotebookPen}
          title="Mis Notas"
          subtitle="Ver calificaciones por periodo"
        />
        <ActionLink
          screenId="ATT-02"
          icon={CalendarCheck}
          title="Mi Asistencia"
          subtitle="Historial de asistencia"
        />
        <ActionLink
          screenId="OBS-05"
          icon={ClipboardList}
          title="Mis Observaciones"
          subtitle="Seguimiento de comportamiento"
        />
      </div>

      <SectionCard
        title={`Mis notas de ${period?.name ?? "ningún periodo"}`}
        description="Nota final por asignatura, escala 1.0 a 5.0"
      >
        {finals.length === 0 ? (
          <EmptyBlock title="Sin notas registradas" />
        ) : (
          <CategoryBarChart
            ariaLabel="Notas finales del último periodo cerrado por asignatura"
            seriesLabel="Nota final"
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            legend={SCORE_LEGEND.filter((band) =>
              finals.some((final) => band.test(final.score)),
            ).map(({ label, color }) => ({ label, color }))}
            valueFormatter={(value) => formatScore(value, 1)}
            data={finals.map((final) => ({
              label: final.code,
              value: final.score,
              color: TONE_COLOR[SCORE_TONE[scoreClass(final.score)]],
            }))}
          />
        )}
      </SectionCard>

      <SectionCard title="Mi Horario de Clases">
        {schedule.length === 0 ? (
          <EmptyBlock title="No se ha generado el horario para tu grado todavía." />
        ) : (
          <WeeklySchedule rows={schedule} />
        )}
      </SectionCard>
    </div>
  );
}
