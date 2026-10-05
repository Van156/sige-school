import { Check, Trophy } from "lucide-react";

import { AchievementCard } from "../../-components/achievement-card";
import { EmptyBlock } from "../../-components/empty-block";
import { ParentChildPage, type ChildContext } from "../../-components/parent-frame";
import { SectionCard } from "../../-components/section-card";
import { useAchievementData } from "../../-lib/achievements";
import { formatDate } from "../../-lib/format";

/** PAR-06: achievements earned by the child plus the full catalogue (unearned ones dimmed). */
export function ChildAchievementsScreen() {
  return (
    <ParentChildPage screenId="PAR-06" title="Logros del hijo/a" section="Logros">
      {(context) => <Achievements {...context} />}
    </ParentChildPage>
  );
}

function Achievements({ student }: ChildContext) {
  const data = useAchievementData();
  const earned = data.earnedBy(student.id).toSorted((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  const earnedIds = new Set(earned.map((row) => row.achievementId));

  return (
    <>
      <p className="text-[13px] text-muted-foreground">
        <strong className="text-foreground">{earned.length}</strong> logros obtenidos
      </p>

      {earned.length === 0 ? (
        <EmptyBlock
          icon={<Trophy />}
          title="Aún no hay logros obtenidos"
          description="Este estudiante aún no ha desbloqueado ningún logro."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {earned.map((row) => {
            const achievement = data.catalogById.get(row.achievementId);
            return achievement ? (
              <AchievementCard
                key={row.id}
                achievement={achievement}
                meta={`Obtenido el ${formatDate(row.earnedAt)}`}
              />
            ) : null;
          })}
        </div>
      )}

      <SectionCard title="Catálogo Completo de Logros">
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.catalog.map((item) => {
            const unlocked = earnedIds.has(item.id);
            return (
              <li
                key={item.id}
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-[13px] ${unlocked ? "bg-success/10" : "opacity-50"}`}
              >
                <span aria-hidden="true" className="text-xl">
                  {item.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground">{item.description}</span>
                </span>
                {unlocked ? <Check className="size-4 text-success" aria-label="Obtenido" /> : null}
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </>
  );
}
