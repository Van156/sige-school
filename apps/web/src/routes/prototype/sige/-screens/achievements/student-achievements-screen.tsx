import { Button } from "@base-template/ui/components/button";
import { Award, Settings2, Trophy } from "lucide-react";
import { useState } from "react";

import { AchievementCard } from "../../-components/achievement-card";
import { ConfirmActionButton } from "../../-components/confirm-action";
import { EmptyBlock } from "../../-components/empty-block";
import { FilterSelect } from "../../-components/filter-select";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { NoStudentBlock, StudentStrip, StudentSwitcher } from "../../-components/student-strip";
import { formatDate } from "../../-lib/format";
import { canManageAchievements, useAchievementData } from "../../-lib/achievements";
import { useGrading } from "../../-lib/use-grading";
import { useRole } from "../../-lib/use-role";
import { useSchool, type School } from "../../-lib/use-school";
import { useStudentScope } from "../../-lib/use-student-scope";
import {
  awardAchievement,
  currentUserFor,
  mockAction,
  mockInfo,
  runAchievementEngine,
} from "../../-mock";
import type { AcademicStudent, Institution } from "../../-mock/types";

/** ACH-02: achievements earned by one student (`?student=`; students and parents see their own). */
export function StudentAchievementsScreen() {
  return (
    <ScopedPage
      screenId="ACH-02"
      title="🏆 Logros del Estudiante"
      description="Reconocimientos obtenidos por periodo"
      target="Logros"
      banner={false}
    >
      {(institution) => <StudentAchievementsView institution={institution} />}
    </ScopedPage>
  );
}

function StudentAchievementsView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const scope = useStudentScope(school);
  return (
    <>
      <StudentSwitcher screenId="ACH-02" scope={scope} school={school} />
      {scope.selected ? (
        <Earned
          student={scope.selected}
          school={school}
          institution={institution}
          staff={scope.mode === "staff"}
        />
      ) : (
        <NoStudentBlock scope={scope} />
      )}
    </>
  );
}

function Earned({
  student,
  school,
  institution,
  staff,
}: {
  student: AcademicStudent;
  school: School;
  institution: Institution;
  staff: boolean;
}) {
  const role = useRole();
  const data = useAchievementData();
  const grading = useGrading(institution.id);
  const canManage = canManageAchievements(role);
  const [quick, setQuick] = useState("");

  const rows = data.earnedBy(student.id).toSorted((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  const countOf = (category: string) =>
    rows.filter((row) => data.catalogById.get(row.achievementId)?.category === category).length;
  const runEngine = () => {
    const awarded = runAchievementEngine(student.id);
    if (awarded > 0) mockAction(`${awarded} logros otorgados`);
    else mockInfo("No se encontraron nuevos logros para otorgar.");
  };

  return (
    <>
      <StudentStrip
        student={student}
        school={school}
        actions={
          <div className="flex flex-wrap gap-2">
            {staff ? (
              <BackButton
                screenId="STU-02"
                search={{ id: String(student.id) }}
                label="Volver al Estudiante"
              />
            ) : null}
            <ScreenLinkButton screenId="ACH-03">Ranking</ScreenLinkButton>
            {canManage ? (
              <ConfirmActionButton
                title="¿Ejecutar el motor para este estudiante?"
                description="Se evaluarán las reglas de logros solo para este estudiante."
                confirmLabel="Ejecutar motor"
                onConfirm={runEngine}
              >
                <Settings2 data-icon="inline-start" />
                Ejecutar Motor
              </ConfirmActionButton>
            ) : null}
          </div>
        }
      />

      <StatGrid columns={3}>
        <StatTile label="Logros" value={rows.length} icon={Trophy} />
        <StatTile label="Académicos" value={countOf("académico")} icon={Award} tone="info" />
        <StatTile label="Mejora" value={countOf("mejora")} icon={Award} tone="success" />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyBlock
              icon={<Trophy />}
              title="📋 Sin logros aún"
              description="Este estudiante aún no ha obtenido logros. Ejecuta el motor automático o otorga logros manualmente."
              action={
                canManage ? (
                  <Button onClick={runEngine}>
                    <Settings2 data-icon="inline-start" />
                    Ejecutar Motor para este Estudiante
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => {
                const achievement = data.catalogById.get(row.achievementId);
                if (!achievement) return null;
                const period = grading.periodById.get(row.periodId ?? -1);
                return (
                  <AchievementCard
                    key={row.id}
                    achievement={achievement}
                    meta={`${period ? `${period.shortName} · ` : ""}${formatDate(row.earnedAt)}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {canManage ? (
          <SectionCard title="🏆 Otorgar Logro Rápido">
            <FilterSelect
              label="Logro"
              value={quick}
              onValueChange={setQuick}
              options={data.catalog.map((item) => ({
                value: String(item.id),
                label: `${item.icon} ${item.name}`,
              }))}
              allLabel="-- Seleccionar --"
            />
            <div>
              <Button
                disabled={!quick}
                onClick={() => {
                  const result = awardAchievement({
                    studentId: student.id,
                    achievementId: Number(quick),
                    awardedBy: currentUserFor(role).id,
                  });
                  if (result.ok) {
                    mockAction("Logro otorgado");
                    setQuick("");
                  } else {
                    mockInfo(result.reason);
                  }
                }}
              >
                Otorgar
              </Button>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
