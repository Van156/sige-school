import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";

import type { ReactNode } from "react";

import { importPreviewSummary } from "../lib/excel-import";
import type { ImportPreview, ImportPreviewRowBase } from "../types";

/** One previewed column: the workbook header and how a row shows it. */
export type ImportPreviewColumn<TRow> = { header: string; cell: (row: TRow) => ReactNode };

/**
 * Card "Vista previa" of an import screen (USR-04, STU-05): "{archivo} · {n} filas, {m} válidas",
 * the first rows in `columns` with their status ("Válida" or the row message) and the import
 * button (`importLabel`), disabled without valid rows. `startError` is the server's refusal of the
 * start (for example a running import); `actions` render next to the button. Presentational.
 */
export default function ImportPreviewCard<TRow extends ImportPreviewRowBase>({
  fileName,
  preview,
  columns,
  importLabel,
  startError,
  onImport,
  actions,
}: {
  fileName: string;
  preview: ImportPreview<TRow>;
  columns: readonly ImportPreviewColumn<TRow>[];
  importLabel: string;
  startError?: string | null;
  onImport: () => void;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Vista previa</CardTitle>
        <CardDescription>
          {importPreviewSummary(fileName, preview.total, preview.valid)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.header}>{column.header}</TableHead>
              ))}
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.row}>
                {columns.map((column) => (
                  <TableCell key={column.header}>{column.cell(row)}</TableCell>
                ))}
                <TableCell>
                  {row.valid ? (
                    <Badge variant="success">Válida</Badge>
                  ) : (
                    <Badge variant="destructive" className="h-auto whitespace-normal">
                      {row.message}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {startError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{startError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={preview.valid === 0} onClick={onImport}>
            {importLabel}
          </Button>
          {actions}
        </div>
      </CardContent>
    </Card>
  );
}
