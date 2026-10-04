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
import { useRole } from "../../-lib/use-role";
import {
  currentUserFor,
  fullName,
  gradeById,
  groupWeeklySchedule,
  scoreClass,
  studentByUserId,
  studentLatestFinals,
} from "../../-mock";

const TONE_COLOR = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  default: "var(--chart-1)",
  secondary: "var(--chart-1)",
  outline: "var(--chart-1)",
} as const;

/** DASH-05: profile card, shortcuts, latest finals and the weekly timetable of the student's group. */
export function StudentDashboard() {
  const role = useRole();
  const user = currentUserFor(role);
  const student = studentByUserId.get(user.id);
  const grade = student?.gradeId ? gradeById.get(student.gradeId) : undefined;

  if (!student) {
    return (
      <EmptyBlock
        title="Perfil académico no configurado"
        description="Contacta al administrador para que asigne tu grado y grupo."
      />
    );
  }

  const schedule = grade ? groupWeeklySchedule(grade.id) : [];
  const finals = studentLatestFinals(student.id, 3);

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
        title="Mis notas del tercer periodo"
        description="Nota final por asignatura, escala 1.0 a 5.0"
      >
        {finals.length === 0 ? (
          <EmptyBlock title="Sin notas registradas" />
        ) : (
          <CategoryBarChart
            ariaLabel="Notas finales del tercer periodo por asignatura"
            seriesLabel="Nota final"
            domain={[0, 5]}
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
