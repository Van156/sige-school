import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";

import { hiddenErrorsLabel, importErrorLabel, summarizeImportErrors } from "../lib/excel-import";
import type { ImportRowError } from "../types";

/**
 * Error card of an import result (USR-R13, STU-R8): "Errores ({n})", the first 10 messages and
 * "... y {m} errores más". `count` is the real number of errors, which can exceed the
 * (server-capped) `errors` list. Job-level errors (`row` 0) show without a row prefix.
 * Presentational.
 */
export default function ImportErrorList({
  errors,
  count,
}: {
  errors: readonly ImportRowError[];
  count: number;
}) {
  if (count === 0) {
    return null;
  }
  const { listed, hidden } = summarizeImportErrors(errors, count);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Errores ({count})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm text-destructive">
          {listed.map((error, index) => (
            <li key={`${error.row}-${index}`}>{importErrorLabel(error)}</li>
          ))}
        </ul>
        {hidden > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{hiddenErrorsLabel(hidden)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
