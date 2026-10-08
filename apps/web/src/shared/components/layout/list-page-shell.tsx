import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import type { ReactNode } from "react";

import PageHeader from "./page-header";

/**
 * Frame of a structure list page (sige/02 §5.2): page header, optional banner and KPI tiles, then
 * the "Listado de …" card holding the table. Slots only; the table owns its loading, error and
 * empty states.
 */
export default function ListPageShell({
  title,
  description,
  actions,
  banner,
  stats,
  listTitle,
  listAction,
  children,
}: {
  title: string;
  description?: string;
  /** Primary action, e.g. the "Nueva Sede" link; omit for read-only roles. */
  actions?: ReactNode;
  banner?: ReactNode;
  /** A `StatGrid`. */
  stats?: ReactNode;
  listTitle: string;
  /** Header slot of the list card, e.g. a count chip. */
  listAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={description} actions={actions} />
      {banner}
      {stats}
      <Card size="sm">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{listTitle}</CardTitle>
          {listAction}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
      </Card>
    </div>
  );
}
