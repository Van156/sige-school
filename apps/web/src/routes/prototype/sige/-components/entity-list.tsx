import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { matchesQuery } from "../-lib/list";
import { EmptyBlock } from "./empty-block";
import { FilterBar } from "./filter-bar";
import { ScreenLinkButton } from "./link-button";
import { SectionCard } from "./section-card";
import { SimpleTable, type TableColumn } from "./simple-table";

/** "Nueva ..." button of a list header, shown only to roles that may create. */
export function CreateButton({
  screenId,
  label,
  canCreate,
}: {
  screenId: string;
  label: string;
  canCreate: boolean;
}) {
  if (!canCreate) return null;
  return (
    <ScreenLinkButton screenId={screenId} variant="default">
      <Plus data-icon="inline-start" />
      {label}
    </ScreenLinkButton>
  );
}

/**
 * Table card of the structure lists: search box, sortable paginated table and the empty state with
 * a create shortcut (legacy `empty_state` macro).
 */
export function EntityList<T>({
  title,
  columns,
  rows,
  getRowId,
  searchText,
  searchPlaceholder = "Buscar",
  emptyIcon,
  emptyTitle,
  emptyDescription,
  create,
  footer,
  filters,
  action,
  pageSize = 10,
}: {
  title: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string | number;
  /** Fields of a row the search box matches against. */
  searchText: (row: T) => Array<string | undefined>;
  searchPlaceholder?: string;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  /** Create shortcut of the empty state; omit for roles that cannot create. */
  create?: { screenId: string; label: string };
  footer?: ReactNode;
  /** Extra filter controls (selects) next to the search box. */
  filters?: ReactNode;
  /** Header slot of the card, e.g. a count chip. */
  action?: ReactNode;
  pageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const visible = rows.filter((row) => matchesQuery(query, ...searchText(row)));
  const searching = query.trim().length > 0;

  return (
    <SectionCard title={title} action={action}>
      <FilterBar query={query} onQueryChange={setQuery} placeholder={searchPlaceholder}>
        {filters}
      </FilterBar>
      <SimpleTable
        columns={columns}
        rows={visible}
        getRowId={getRowId}
        pageSize={pageSize}
        empty={
          <EmptyBlock
            icon={emptyIcon}
            title={searching ? "Sin resultados" : emptyTitle}
            description={searching ? "Nada coincide con la búsqueda." : emptyDescription}
            action={
              !searching && create ? (
                <ScreenLinkButton screenId={create.screenId} variant="default">
                  {create.label}
                </ScreenLinkButton>
              ) : undefined
            }
          />
        }
      />
      {footer}
    </SectionCard>
  );
}
