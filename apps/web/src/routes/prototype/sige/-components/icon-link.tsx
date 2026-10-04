import { buttonVariants } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";
import type { ReactNode } from "react";

import { ScreenLink } from "./sige-link";

/** Ghost icon button that navigates to a screen (view / edit / quick-action links of table rows). */
export function IconLink({
  screenId,
  search,
  label,
  children,
}: {
  screenId: string;
  search?: Record<string, string | undefined>;
  /** Accessible name and tooltip, e.g. "Ver perfil de Mariana López". */
  label: string;
  children: ReactNode;
}) {
  return (
    <ScreenLink
      screenId={screenId}
      search={search}
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
    >
      {children}
    </ScreenLink>
  );
}
