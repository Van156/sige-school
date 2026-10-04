import type { ReactNode } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";

/** Bordered empty state used by every list and widget of the prototype. */
export function EmptyBlock({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed">
      <EmptyState title={title} description={description} icon={icon} action={action} />
    </div>
  );
}
