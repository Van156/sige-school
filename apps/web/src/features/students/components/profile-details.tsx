import { cn } from "@base-template/ui/lib/utils";
import { isValidElement, type ReactElement } from "react";

import { displayValue } from "../lib/student-profile";

export type ProfileDetail = {
  label: string;
  /** Text, or `null`/blank for "N/A"; pass a node for badges and other rich values. */
  value: string | number | null | ReactElement;
  /** Monospace text, e.g. a username. */
  mono?: boolean;
};

/**
 * Label/value pairs of the STU-02 cards (sige/05 §5.2); every empty value reads "N/A".
 * Presentational.
 */
export default function ProfileDetails({
  items,
  className,
}: {
  items: readonly ProfileDetail[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-3 text-[13px] sm:grid-cols-2", className)}>
      {items.map((item) => {
        const { value } = item;
        if (isValidElement(value)) {
          return (
            <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd>{value}</dd>
            </div>
          );
        }
        return (
          <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={cn("truncate", item.mono && value ? "font-mono" : null)}>
              {displayValue(value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
