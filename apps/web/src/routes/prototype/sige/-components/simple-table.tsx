import { Button } from "@base-template/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";
import { useState, type ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "right" | "center";
  className?: string;
}

/**
 * Compact bordered table (13px text, tabular numbers) with optional local pagination. Search and
 * sort are the caller's job: filter `rows` before passing them in (see `FilterBar`).
 */
export function SimpleTable<T>({
  columns,
  rows,
  getRowId,
  pageSize,
  empty,
  className,
}: {
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string | number;
  pageSize?: number;
  empty?: ReactNode;
  className?: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = pageSize ? rows.slice(safePage * pageSize, (safePage + 1) * pageSize) : rows;

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
                  className={cn(
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    column.className,
                  )}
                >
                  {column.header}
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
        </Table>
      </div>
      {pageSize && pageCount > 1 ? (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="tabular-nums">
            {rows.length} registros · página {safePage + 1} de {pageCount}
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
