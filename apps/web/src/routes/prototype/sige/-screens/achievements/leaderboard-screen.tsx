import { Badge } from "@base-template/ui/components/badge";
import { cn } from "@base-template/ui/lib/utils";
import { Trophy } from "lucide-react";
import { useState } from "react";

import { ConfirmActionButton } from "../../-components/confirm-action";
import { EmptyBlock } from "../../-components/empty-block";
import { FilterSelect } from "../../-components/filter-select";
import { ScreenLink } from "../../-components/sige-link";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { canManageAchievements, useAchievementData } from "../../-lib/achievements";
import { gradeOptions } from "../../-lib/school-options";
import { useRole } from "../../-lib/use-role";
import { useSchool } from "../../-lib/use-school";
import { useStudentScope } from "../../-lib/use-student-scope";
import { mockAction, mockInfo, runAchievementEngine } from "../../-mock";
import type { Institution } from "../../-mock/types";

interface Entry {
  studentId: number;
  name: string;
  course: string;
  count: number;
  rank: number;
}

const LIMITS = [
  { value: "10", label: "Top 10" },
  { value: "25", label: "Top 25" },
  { value: "50", label: "Top 50" },
  { value: "100", label: "Top 100" },
];

const MEDAL = ["🏆", "🥈", "🥉"] as const;

/** ACH-03: student ranking by number of achievements, with podium and filters. */
export function LeaderboardScreen() {
  return (
    <ScopedPage
      screenId="ACH-03"
      title="🏆 Ranking Estudiantil"
      description="Estudiantes con más logros obtenidos"
      target="Logros"
      banner={false}
    >
      {(institution) => <Leaderboard institution={institution} />}
    </ScopedPage>
  );
}

function Leaderboard({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const scope = useStudentScope(school);
  const role = useRole();
  const data = useAchievementData();
  const [gradeId, setGradeId] = useState("");
  const [limit, setLimit] = useState("50");

  const entries: Entry[] = school.students
    .filter((student) => !gradeId || String(student.gradeId) === gradeId)
    .map((student) => ({
      studentId: student.id,
      name: school.studentName(student.id),
      course: school.gradeName(student.gradeId) ?? "Sin grado",
      count: data.earnedBy(student.id).length,
      rank: 0,
    }))
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
    .slice(0, Number(limit))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const viewable = new Set(scope.allowed.map((student) => student.id));
  const canOpen = (studentId: number) => scope.mode === "staff" || viewable.has(studentId);

  const columns: TableColumn<Entry>[] = [
    { key: "rank", header: "#", sortValue: (row) => row.rank, cell: (row) => row.rank },
    {
      key: "medal",
      header: "Medalla",
      cell: (row) => <span aria-hidden="true">{MEDAL[row.rank - 1] ?? "☆"}</span>,
    },
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => row.name,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: "course", header: "Grado", sortValue: (row) => row.course, cell: (row) => row.course },
    {
      key: "count",
      header: "Logros",
      align: "right",
      sortValue: (row) => row.count,
      cell: (row) => <Badge variant="info">{row.count}</Badge>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      align: "right",
      cell: (row) =>
        canOpen(row.studentId) ? (
          <ScreenLink
            screenId="ACH-02"
            search={{ student: String(row.studentId) }}
            className="text-[13px] underline-offset-4 hover:underline"
          >
            Ver Logros
          </ScreenLink>
        ) : null,
    },
  ];

  return (
    <>
      {entries.length >= 3 ? <Podium entries={entries.slice(0, 3)} canOpen={canOpen} /> : null}

      <SectionCard
        title="Ranking Completo"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Filtrar por grado"
              value={gradeId}
              onValueChange={setGradeId}
              options={gradeOptions(school.grades)}
              allLabel="-- Todos los grados --"
            />
            <FilterSelect label="Mostrar" value={limit} onValueChange={setLimit} options={LIMITS} />
          </div>
        }
      >
        <SimpleTable
          columns={columns}
          rows={entries}
          getRowId={(row) => row.studentId}
          pageSize={15}
          empty={
            <EmptyBlock
              icon={<Trophy />}
              title="📋 Sin datos de ranking"
              description="Aún no hay estudiantes con logros. Ejecuta el motor automático para generar logros."
              action={
                canManageAchievements(role) ? (
                  <ConfirmActionButton
                    variant="default"
                    title="¿Ejecutar el motor de logros para todos los estudiantes?"
                    description="Se evaluarán las siete reglas del catálogo."
                    confirmLabel="Ejecutar motor"
                    onConfirm={() => {
                      const awarded = runAchievementEngine();
                      if (awarded > 0) mockAction(`${awarded} logros otorgados`);
                      else mockInfo("No se encontraron nuevos logros para otorgar.");
                    }}
                  >
                    ⚙️ Ejecutar Motor Automático
                  </ConfirmActionButton>
                ) : undefined
              }
            />
          }
        />
      </SectionCard>
    </>
  );
}

/** Top three: 2nd on the left, 1st raised in the centre, 3rd on the right. */
function Podium({
  entries,
  canOpen,
}: {
  entries: readonly Entry[];
  canOpen: (studentId: number) => boolean;
}) {
  const order = [entries[1], entries[0], entries[2]].flatMap((entry) => (entry ? [entry] : []));
  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {order.map((entry) => (
        <article
          key={entry.studentId}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center",
            entry.rank === 1 && "border-warning bg-warning/10 pb-6",
          )}
        >
          <span aria-hidden="true" className={entry.rank === 1 ? "text-4xl" : "text-3xl"}>
            {MEDAL[entry.rank - 1]}
          </span>
          {entry.rank === 1 ? <Badge variant="warning">👑 1° Lugar</Badge> : null}
          <span className="text-sm font-semibold">{entry.name}</span>
          <span className="text-xs text-muted-foreground">{entry.course}</span>
          <span className="text-2xl font-semibold tabular-nums">{entry.count}</span>
          <span className="text-xs text-muted-foreground">logros</span>
          {canOpen(entry.studentId) ? (
            <ScreenLink
              screenId="ACH-02"
              search={{ student: String(entry.studentId) }}
              className="text-[13px] underline-offset-4 hover:underline"
            >
              Ver Logros
            </ScreenLink>
          ) : null}
          {entry.rank > 1 ? (
            <span className="text-xs text-muted-foreground">{entry.rank}° Lugar</span>
          ) : null}
        </article>
      ))}
    </div>
  );
}
