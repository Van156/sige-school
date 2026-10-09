import { Card } from "@base-template/ui/components/card";
import { cn } from "@base-template/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** KPI tile: optional icon, muted label, large tabular value and an optional hint line. */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
}) {
  return (
    <Card size="sm" className="flex-row items-center gap-3 px-(--card-spacing)">
      {Icon ? (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
        >
          <Icon className="size-4" />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] text-muted-foreground">{label}</span>
        <span className="text-2xl leading-8 font-semibold tracking-[-0.01em] tabular-nums">
          {value}
        </span>
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  );
}

/** Responsive grid for a row of stat tiles. */
export function StatGrid({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
        columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}
