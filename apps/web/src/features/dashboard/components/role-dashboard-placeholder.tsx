import type { ReactNode } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import PageHeader from "@/shared/components/layout/page-header";

/** Neutral landing for a dashboard whose widgets are not built yet (DASH-03…07, root). */
export default function RoleDashboardPlaceholder({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} actions={action} />
      <EmptyState
        title="Sin información para mostrar"
        description="Los indicadores de este panel aparecerán cuando los módulos estén disponibles."
      />
    </div>
  );
}
