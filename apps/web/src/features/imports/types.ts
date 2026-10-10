/** One entry of `importPreview.errors` and `importJob.get.errors`; `row` 0 is a job-level error. */
export type ImportRowError = { row: number; message: string };

/** What every previewed row carries, whatever its columns (USR-04, STU-05). */
export type ImportPreviewRowBase = {
  row: number;
  valid: boolean;
  /** The row's error message, or `null` when valid. */
  message: string | null;
};

/** `<entity>.importPreview`: the dry run of an upload (first 50 rows, first 200 errors). */
export type ImportPreview<TRow extends ImportPreviewRowBase = ImportPreviewRowBase> = {
  total: number;
  valid: number;
  invalid: number;
  rows: TRow[];
  errors: ImportRowError[];
};

export type ImportJobStatus = "running" | "done" | "failed";

/** `importJob.get`: the progress of a started import. */
export type ImportJob = {
  status: ImportJobStatus;
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: ImportRowError[];
};

/** Singular and plural noun of the imported entity, e.g. "usuario" / "usuarios". */
export type ImportNoun = { one: string; other: string };
