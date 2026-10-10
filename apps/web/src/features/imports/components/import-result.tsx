import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import { CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";

import {
  importErrorCount,
  importFailureReason,
  importRowErrors,
  importedMessage,
} from "../lib/excel-import";
import type { ImportJob, ImportNoun } from "../types";
import ImportErrorList from "./import-error-list";

/**
 * Result of a finished import job (USR-R13, STU-R8): the callout with the imported and skipped
 * counts, the error card, the reset button (`resetLabel`) and `listAction` (the link to the
 * entity list). A `failed` job keeps what it imported before stopping and shows why it stopped
 * (the job-level, `row` 0 error) in the callout; the error card lists row errors only.
 * Presentational.
 */
export default function ImportResult({
  job,
  noun,
  resetLabel,
  listAction,
  onReset,
}: {
  job: Pick<ImportJob, "status" | "imported" | "skipped" | "errors">;
  /** The imported entity, e.g. "usuario" / "usuarios". */
  noun: ImportNoun;
  resetLabel: string;
  listAction: ReactNode;
  onReset: () => void;
}) {
  const failed = job.status === "failed";
  const reason = failed ? importFailureReason(job.errors) : null;
  const skipped = job.skipped > 0 ? `${job.skipped} filas omitidas.` : undefined;
  return (
    <div className="flex flex-col gap-4">
      {failed ? (
        <Alert variant="destructive">
          <CircleX />
          <AlertTitle>La importación no se completó</AlertTitle>
          {reason ? <AlertDescription>{reason}</AlertDescription> : null}
          <AlertDescription>
            {[importedMessage(job.imported, noun), skipped].filter(Boolean).join(". ")}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CircleCheck />
          <AlertTitle>{importedMessage(job.imported, noun)}</AlertTitle>
          {skipped ? <AlertDescription>{skipped}</AlertDescription> : null}
        </Alert>
      )}
      <ImportErrorList errors={importRowErrors(job.errors)} count={importErrorCount(job)} />
      <div className="flex gap-2">
        <Button type="button" onClick={onReset}>
          {resetLabel}
        </Button>
        {listAction}
      </div>
    </div>
  );
}
