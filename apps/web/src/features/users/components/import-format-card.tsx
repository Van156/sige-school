import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";

import {
  IMPORT_COLUMNS,
  IMPORT_EXAMPLE_ROW,
  IMPORT_ROLES_NOTE,
  IMPORT_STUDENT_NOTE,
} from "../lib/import-format";

/** USR-04 card "Formato Requerido": the USR-R11 columns with an example row. Presentational. */
export default function ImportFormatCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Formato Requerido</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Columna</TableHead>
              <TableHead>Obligatoria</TableHead>
              <TableHead>Valores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {IMPORT_COLUMNS.map((column) => (
              <TableRow key={column.name}>
                <TableCell className="font-mono text-xs">{column.name}</TableCell>
                <TableCell>{column.required ? "Sí" : "No"}</TableCell>
                <TableCell>{column.values}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div>
          <p className="mb-1 font-medium">Fila de ejemplo</p>
          <p className="font-mono text-xs">{IMPORT_EXAMPLE_ROW.join(" | ")}</p>
        </div>
        <p className="text-muted-foreground">{IMPORT_ROLES_NOTE}</p>
        <p className="text-muted-foreground">{IMPORT_STUDENT_NOTE}</p>
      </CardContent>
    </Card>
  );
}
