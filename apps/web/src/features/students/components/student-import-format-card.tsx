import { STUDENT_IMPORT_COLUMNS } from "@base-template/sige-core";
import {
  Card,
  CardAction,
  CardContent,
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

/**
 * STU-05 card "Formato Requerido" (sige/05 §5.5, STU-R8): the sixteen workbook columns with
 * "Obligatorio" ✅/❌; `download` renders in the header ("Descargar Plantilla"). Presentational.
 */
export default function StudentImportFormatCard({ download }: { download?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Formato Requerido</CardTitle>
        {download ? <CardAction>{download}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Columna</TableHead>
              <TableHead>Obligatorio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STUDENT_IMPORT_COLUMNS.map((column) => (
              <TableRow key={column.field}>
                <TableCell className="font-mono text-xs">{column.field}</TableCell>
                <TableCell>
                  <span role="img" aria-label={column.required ? "Sí" : "No"}>
                    {column.required ? "✅" : "❌"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
