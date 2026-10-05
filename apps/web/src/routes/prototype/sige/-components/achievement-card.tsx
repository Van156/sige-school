import { Badge } from "@base-template/ui/components/badge";
import { cn } from "@base-template/ui/lib/utils";
import type { ReactNode } from "react";

import { ACHIEVEMENT_CATEGORY_LABEL, ACHIEVEMENT_CATEGORY_TONE } from "../-lib/achievements";
import type { Achievement } from "../-mock/types";

/** Achievement tile: emoji, name, description and category; `muted` dims unearned ones. */
export function AchievementCard({
  achievement,
  muted = false,
  meta,
  footer,
}: {
  achievement: Achievement;
  muted?: boolean;
  /** Small line under the description (period and date, award count). */
  meta?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 text-center",
        muted && "opacity-50",
      )}
    >
      <span aria-hidden="true" className="text-3xl">
        {achievement.icon}
      </span>
      <h3 className="text-sm font-semibold">{achievement.name}</h3>
      <p className="text-[13px] text-muted-foreground">{achievement.description}</p>
      <div>
        <Badge variant={ACHIEVEMENT_CATEGORY_TONE[achievement.category]}>
          {ACHIEVEMENT_CATEGORY_LABEL[achievement.category]}
        </Badge>
      </div>
      {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
      {footer}
    </article>
  );
}
