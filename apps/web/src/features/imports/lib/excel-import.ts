import type { ImportJob, ImportJobStatus, ImportNoun, ImportRowError } from "../types";

/** `importJob.get` is polled this often while the import runs (USR-R12). */
export const IMPORT_POLL_INTERVAL_MS = 2000;

/** Client-side pre-check limit; the server enforces the same 10 MB (USR-R12). */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

/** The `accept` attribute of the file input. */
export const IMPORT_ACCEPT = ".xlsx";

/** The picker hint: "Solo archivos .xlsx (máx 10MB)", built from the accept and size limits. */
export const IMPORT_FILE_HINT = `Solo archivos ${IMPORT_ACCEPT} (máx ${IMPORT_MAX_BYTES / (1024 * 1024)}MB)`;

export const IMPORT_EXTENSION_MESSAGE = "Solo se permiten archivos Excel (.xlsx).";
/** AUTH-05 copy for 413. */
export const IMPORT_SIZE_MESSAGE =
  "El archivo que intentas subir supera el tamaño máximo permitido.";
export const IMPORT_PREVIEW_FALLBACK = "No se pudo leer el archivo. Intente nuevamente.";
export const IMPORT_START_FALLBACK = "No se pudo iniciar la importación. Intente nuevamente.";

/** Errors listed before the "... y {m} errores más" line (USR-R13). */
export const IMPORT_LISTED_ERRORS = 10;

/**
 * Pre-checks a picked file like the server (extension, then size) so an obvious mistake fails
 * before the upload. Returns the Spanish message to show, or `null` when the file may be sent.
 */
export function validateImportFile(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith(IMPORT_ACCEPT)) {
    return IMPORT_EXTENSION_MESSAGE;
  }
  return file.size > IMPORT_MAX_BYTES ? IMPORT_SIZE_MESSAGE : null;
}

const MESSAGE_CODES = new Set(["BAD_REQUEST", "CONFLICT", "PAYLOAD_TOO_LARGE"]);

/**
 * The text to show for a failed preview or start: the server's own message for a rule it owns
 * (bad file, running import, too large), else `fallback` (network or unexpected failures).
 */
export function importErrorMessage(error: unknown, fallback: string): string {
  const { code, message, status } = (typeof error === "object" && error !== null ? error : {}) as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };
  if (status === 413) {
    return IMPORT_SIZE_MESSAGE;
  }
  const known = typeof code === "string" && MESSAGE_CODES.has(code);
  return known && typeof message === "string" && message.trim() ? message : fallback;
}

/** Whether the job will not change any more. */
export function isImportTerminal(status: ImportJobStatus | undefined): boolean {
  return status === "done" || status === "failed";
}

/** `refetchInterval` of the job query: keep polling until the job is terminal. */
export function importPollInterval(status: ImportJobStatus | undefined): number | false {
  return isImportTerminal(status) ? false : IMPORT_POLL_INTERVAL_MS;
}

/** Whole percent of rows processed, clamped to 0-100; 0 while the total is unknown. */
export function importProgressPercent(processed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((processed / total) * 100)));
}

/** "Importando… {processed} de {total}". */
export function importProgressLabel(processed: number, total: number): string {
  return `Importando… ${processed} de ${total}`;
}

/** "{archivo} · {n} filas, {m} válidas" (the preview card description). */
export function importPreviewSummary(fileName: string, total: number, valid: number): string {
  return `${fileName} · ${total} filas, ${valid} válidas`;
}

/**
 * "{n} {noun} importados exitosamente" (USR-R13, STU-R8); singular for one, e.g. "1 usuario
 * importado exitosamente".
 */
export function importedMessage(imported: number, noun: ImportNoun): string {
  return imported === 1
    ? `1 ${noun.one} importado exitosamente`
    : `${imported} ${noun.other} importados exitosamente`;
}

/**
 * The text of one error line. Row messages arrive as "Fila {n}: …"; a job-level error (`row` 0,
 * e.g. an interrupted import) has no row, so it is shown as is, never with a "Fila" prefix.
 */
export function importErrorLabel(error: ImportRowError): string {
  if (error.row <= 0 || /^Fila \d+:/.test(error.message)) {
    return error.message;
  }
  return `Fila ${error.row}: ${error.message}`;
}

/** First errors to list and how many are left out ("... y {m} errores más"). */
export function summarizeImportErrors(
  errors: readonly ImportRowError[],
  count: number,
  limit: number = IMPORT_LISTED_ERRORS,
): { listed: ImportRowError[]; hidden: number } {
  const listed = errors.slice(0, limit);
  return { listed, hidden: Math.max(0, count - listed.length) };
}

/** "... y {m} errores más". */
export function hiddenErrorsLabel(hidden: number): string {
  return hidden === 1 ? "... y 1 error más" : `... y ${hidden} errores más`;
}

/** A job-level entry (`row` 0, e.g. an interrupted import) is not about a spreadsheet row. */
function isJobLevelError(error: ImportRowError): boolean {
  return error.row <= 0;
}

/**
 * Why a job stopped as a whole: the message of its job-level (`row` 0) error, or `null` when the
 * job only has row errors. Shown in the failed-job callout instead of the row error list.
 */
export function importFailureReason(errors: readonly ImportRowError[]): string | null {
  return errors.find(isJobLevelError)?.message ?? null;
}

/** The row errors of a job: its list without the job-level (`row` 0) entries. */
export function importRowErrors(errors: readonly ImportRowError[]): ImportRowError[] {
  return errors.filter((error) => !isJobLevelError(error));
}

/**
 * Number of row errors of a finished job. The list is capped by the server while `skipped` is
 * exact, so the larger of the two wins; job-level entries are not skipped rows and never count.
 */
export function importErrorCount(job: Pick<ImportJob, "errors" | "skipped">): number {
  return Math.max(importRowErrors(job.errors).length, job.skipped);
}

export type ImportPhase = "select" | "previewing" | "ready" | "running" | "finished";

/** Where the import screen is in its flow. */
export function importPhase(state: {
  jobId: string | null;
  jobStatus: ImportJobStatus | undefined;
  startPending: boolean;
  previewPending: boolean;
  hasPreview: boolean;
}): ImportPhase {
  if (state.jobId !== null || state.startPending) {
    return isImportTerminal(state.jobStatus) ? "finished" : "running";
  }
  if (state.previewPending) {
    return "previewing";
  }
  return state.hasPreview ? "ready" : "select";
}
