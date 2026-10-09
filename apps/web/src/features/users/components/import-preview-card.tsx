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

import { importPreviewSummary } from "../lib/user-import";
import type { ImportPreview } from "../types";

/**
 * USR-04 card "Vista previa" (sige/03 §5.4): "{archivo} · {n} filas, {m} válidas", the first
 * rows with their status ("Válida" or the row message) and the "Importar Usuarios" button, which
 * is disabled without valid rows. `startError` is the server's refusal of the start (for example a
 * running import). Presentational.
 */
export default function ImportPreviewCard({
  fileName,
  preview,
  startError,
  onImport,
}: {
  fileName: string;
  preview: ImportPreview;
  startError?: string | null;
  onImport: () => void;
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
              <TableHead>nombres</TableHead>
              <TableHead>apellidos</TableHead>
              <TableHead>documento</TableHead>
              <TableHead>rol</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.row}>
                <TableCell>{row.nombres}</TableCell>
                <TableCell>{row.apellidos}</TableCell>
                <TableCell>{row.documento}</TableCell>
                <TableCell>{row.rol}</TableCell>
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
        <div>
          <Button type="button" disabled={preview.valid === 0} onClick={onImport}>
            Importar Usuarios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
