import type { ReactNode } from "react";

/**
 * Page title (20px), optional description, a left-aligned `back` slot above the title and a
 * right-aligned `actions` slot. Breadcrumbs live in the shell header.
 */
export function SigePageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: ReactNode;
  /** Back navigation (see `BackButton`), rendered on the left above the title. */
  back?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {back ? <div className="flex flex-wrap items-center gap-2 print:hidden">{back}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
