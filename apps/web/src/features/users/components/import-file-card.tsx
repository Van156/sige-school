import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { Download } from "lucide-react";
import { useId } from "react";

import { IMPORT_ACCEPT } from "../lib/user-import";

/**
 * USR-04 card "Archivo Excel" (sige/03 §5.4): the `.xlsx` picker and "Descargar Plantilla".
 * Presentational: `onSelect` receives the picked file (or `null` when cleared), `error` is the
 * text of a rejected file (client pre-check or server).
 */
export default function ImportFileCard({
  error,
  isBusy = false,
  isDownloading = false,
  onSelect,
  onDownloadTemplate,
}: {
  error?: string | null;
  /** The preview is running: the picker is locked. */
  isBusy?: boolean;
  isDownloading?: boolean;
  onSelect: (file: File | null) => void;
  onDownloadTemplate: () => void;
}) {
  const inputId = useId();
  const helpId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Archivo Excel</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={inputId}>Archivo Excel *</FieldLabel>
          <Input
            id={inputId}
            type="file"
            accept={IMPORT_ACCEPT}
            disabled={isBusy}
            aria-invalid={error ? true : undefined}
            aria-describedby={helpId}
            onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
          />
          <FieldDescription id={helpId}>Solo archivos .xlsx (máx 10MB)</FieldDescription>
        </Field>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={isDownloading}
            onClick={onDownloadTemplate}
          >
            <Download data-icon="inline-start" />
            Descargar Plantilla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
