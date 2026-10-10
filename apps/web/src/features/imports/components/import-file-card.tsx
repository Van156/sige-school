import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useId, type ReactNode } from "react";

import { IMPORT_ACCEPT, IMPORT_FILE_HINT } from "../lib/excel-import";

/**
 * The `.xlsx` picker card of an import screen (USR-04 "Archivo Excel", STU-05 "Subir Archivo").
 * Presentational: `onSelect` receives the picked file (or `null` when cleared), `error` is the
 * text of a rejected file (client pre-check or server); `children` render below the picker (the
 * screen's callout or "Descargar Plantilla").
 */
export default function ImportFileCard({
  title,
  label = "Archivo Excel *",
  hint = IMPORT_FILE_HINT,
  error,
  isBusy = false,
  onSelect,
  children,
}: {
  title: string;
  label?: string;
  hint?: string;
  error?: string | null;
  /** The preview is running: the picker is locked. */
  isBusy?: boolean;
  onSelect: (file: File | null) => void;
  children?: ReactNode;
}) {
  const inputId = useId();
  const helpId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
          <Input
            id={inputId}
            type="file"
            accept={IMPORT_ACCEPT}
            disabled={isBusy}
            aria-invalid={error ? true : undefined}
            aria-describedby={helpId}
            onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
          />
          <FieldDescription id={helpId}>{hint}</FieldDescription>
        </Field>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}
