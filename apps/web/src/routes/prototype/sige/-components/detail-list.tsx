import type { ReactNode } from "react";

/** Label / value pairs of a profile card; empty values render as "N/A" like the legacy screens. */
export function DetailList({
  items,
}: {
  items: ReadonlyArray<readonly [label: string, value: ReactNode]>;
}) {
  return (
    <dl className="grid gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="break-words">
            {value === undefined || value === null || value === "" ? (
              <span className="text-muted-foreground">N/A</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
