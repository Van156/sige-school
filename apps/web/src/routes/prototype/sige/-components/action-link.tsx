import { ChevronRight, type LucideIcon } from "lucide-react";

import { ScreenLink } from "./sige-link";

/** Clickable row-card to a screen (legacy `config_link` / `quick_link_card`). */
export function ActionLink({
  screenId,
  title,
  subtitle,
  icon: Icon,
  search,
}: {
  screenId: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  search?: Record<string, string | undefined>;
}) {
  return (
    <ScreenLink
      screenId={screenId}
      search={search}
      className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
        >
          <Icon className="size-4" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        {subtitle ? (
          <span className="truncate text-[13px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </ScreenLink>
  );
}
