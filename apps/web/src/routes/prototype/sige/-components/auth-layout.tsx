import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";

import { ModeToggle } from "@/shared/components/layout/mode-toggle";

/**
 * Split auth screen, same structure as the real auth layout: ink brand panel (about 40%) and a
 * form column; below `md` the panel collapses to a strip. No shell, no role context needed.
 */
export function SigeAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-svh grid-cols-1 grid-rows-[auto_1fr] bg-background md:grid-cols-[2fr_3fr] md:grid-rows-1">
      <aside className="flex flex-col bg-sidebar px-4 py-3 text-sidebar-foreground md:p-10">
        <div className="flex items-center gap-3">
          <span className="flex size-6 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground md:size-8">
            <GraduationCap className="size-4 md:size-5" />
          </span>
          <span className="text-sm font-semibold md:text-base">SIGE</span>
        </div>
        <p className="mt-auto hidden max-w-xs text-base/relaxed text-sidebar-foreground/80 md:block">
          Sistema Integral de Gestión Escolar
        </p>
        <p className="mt-10 hidden text-xs text-sidebar-foreground/60 md:block">
          © 2026 SIGE - Sistema Integral de Gestión Escolar
        </p>
      </aside>
      <main className="flex items-start px-4 py-8 md:items-center md:px-12 md:py-10 lg:px-20">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <div className="absolute top-2.5 right-3 md:top-4 md:right-4">
        <ModeToggle />
      </div>
    </div>
  );
}

/** Auth heading: optional icon tile, 28px title, muted description. */
export function AuthHeading({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-foreground [&_svg:not([class*='size-'])]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.01em]">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
