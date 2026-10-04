import { Button } from "@base-template/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "right" | "center";
  className?: string;
  /** Makes the column sortable: the value rows are compared by (strings sort with Spanish collation). */
  sortValue?: (row: T) => string | number | null | undefined;
}

type SortState = { key: string; direction: "asc" | "desc" } | null;

function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
}

/**
 * Compact bordered table (13px text, tabular numbers) with optional local pagination and
 * click-to-sort headers (columns that declare `sortValue`). Search is the caller's job: filter
 * `rows` before passing them in (see `FilterBar`).
 */
export function SimpleTable<T>({
  columns,
  rows,
  getRowId,
  pageSize,
  empty,
  footer,
  className,
}: {
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string | number;
  pageSize?: number;
  empty?: ReactNode;
  /** Summary rows (`<TableRow>`s) rendered in the table footer, e.g. column averages. */
  footer?: ReactNode;
  className?: string;
}) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>(null);

  const sortColumn = sort ? columns.find((column) => column.key === sort.key) : undefined;
  const sortValue = sortColumn?.sortValue;
  const sorted =
    sort && sortValue
      ? [...rows].sort(
          (a, b) => compareValues(sortValue(a), sortValue(b)) * (sort.direction === "asc" ? 1 : -1),
        )
      : rows;

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = pageSize ? sorted.slice(safePage * pageSize, (safePage + 1) * pageSize) : sorted;

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key !== key
        ? { key, direction: "asc" }
        : current.direction === "asc"
          ? { key, direction: "desc" }
          : null,
    );

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  aria-sort={
                    sort?.key === column.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <SortButton
                      direction={sort?.key === column.key ? sort.direction : null}
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                    </SortButton>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {footer ? <TableFooter>{footer}</TableFooter> : null}
        </Table>
      </div>
      {pageSize && pageCount > 1 ? (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="tabular-nums">
            {sorted.length} registros · página {safePage + 1} de {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortButton({
  direction,
  onClick,
  children,
}: {
  direction: "asc" | "desc" | null;
  onClick: () => void;
  children: ReactNode;
}) {
  const Icon =
    direction === "asc" ? ChevronUp : direction === "desc" ? ChevronDown : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
      <Icon className={cn("size-3.5", direction ? "text-foreground" : "text-muted-foreground")} />
    </button>
  );
}
