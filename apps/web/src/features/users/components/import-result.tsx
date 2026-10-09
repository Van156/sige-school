import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { CircleCheck, CircleX } from "lucide-react";

import { importedMessage, importErrorCount } from "../lib/user-import";
import type { ImportJob } from "../types";
import ImportErrorList from "./import-error-list";

/**
 * USR-04 result (USR-R13) of a finished job: the callout with the imported and skipped counts,
 * the error card and the "Importar otro archivo" / "Ver usuarios" actions. A `failed` job keeps
 * what it imported before stopping. Presentational.
 */
export default function ImportResult({
  job,
  onReset,
}: {
  job: Pick<ImportJob, "status" | "imported" | "skipped" | "errors">;
  onReset: () => void;
}) {
  const failed = job.status === "failed";
  const skipped = job.skipped > 0 ? `${job.skipped} filas omitidas.` : undefined;
  return (
    <div className="flex flex-col gap-4">
      {failed ? (
        <Alert variant="destructive">
          <CircleX />
          <AlertTitle>La importación no se completó</AlertTitle>
          <AlertDescription>
            {[importedMessage(job.imported), skipped].filter(Boolean).join(". ")}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CircleCheck />
          <AlertTitle>{importedMessage(job.imported)}</AlertTitle>
          {skipped ? <AlertDescription>{skipped}</AlertDescription> : null}
        </Alert>
      )}
      <ImportErrorList errors={job.errors} count={importErrorCount(job)} />
      <div className="flex gap-2">
        <Button type="button" onClick={onReset}>
          Importar otro archivo
        </Button>
        <Link to="/usuarios" className={buttonVariants({ variant: "outline" })}>
          Ver usuarios
        </Link>
      </div>
    </div>
  );
}
