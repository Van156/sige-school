/**
 * Server-side CSV builder for the `File` exports of sige/07 §4.1 and sige/08 §4.1 (D11):
 * `text/csv; charset=utf-8`, UTF-8 byte order mark, comma separated, RFC 4180 quoting, CRLF line
 * ends and the OWASP formula-injection guard.
 *
 * It mirrors `apps/web/src/shared/lib/data-table/csv.ts` rule for rule (without importing from the
 * web app, which the server cannot depend on), so the client export of the ATT-01 roll sheet and a
 * server export of the same rows are identical byte for byte.
 */

/** One CSV column: its header and how to read the cell from a row. */
export type CsvColumn<TRow> = {
  header: string;
  value: (row: TRow) => unknown;
};

/** UTF-8 byte order mark: lets Excel read non-ASCII text in a CSV correctly. */
export const CSV_BOM = "﻿";

/** Media type of every CSV export (07 §4.1, 08 §4.1). */
export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

const LINE_END = "\r\n";
/** Leading characters a spreadsheet may read as the start of a formula (OWASP CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * One CSV cell (RFC 4180): quoted when it holds a comma, quote or line break (quotes doubled).
 * A text cell starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` so a spreadsheet
 * shows it as text instead of evaluating it; real numbers are not text and are left alone.
 */
export function escapeCsvCell(value: unknown): string {
  const text = toText(value);
  const guarded = typeof value === "string" && FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** CSV text for `rows`: a header line, then one line per row, each ended by CRLF. No BOM. */
export function toCsv<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(","),
  );
  return [header, ...lines].map((line) => line + LINE_END).join("");
}

/** The body of a CSV response: the byte order mark followed by the CSV text. */
export function csvBody<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]): string {
  return CSV_BOM + toCsv(rows, columns);
}

/** The `File` an export procedure returns (R3.10): UTF-8 with a BOM, named `filename`. */
export function csvFile<TRow>(
  filename: string,
  rows: readonly TRow[],
  columns: readonly CsvColumn<TRow>[],
): File {
  return new File([csvBody(rows, columns)], filename, { type: CSV_CONTENT_TYPE });
}

/* ------------------------------- Headers ------------------------------- */

/** ATT-02 student history (07 §4.1). */
export const ATTENDANCE_HISTORY_CSV_HEADERS = [
  "Fecha",
  "Asignatura",
  "Estado",
  "Observación",
  "Registrado por",
] as const;

/** ATT-03 group summary and ATT-04 range report share one header row (07 §4.1). */
export const ATTENDANCE_SUMMARY_CSV_HEADERS = [
  "Estudiante",
  "Presentes",
  "Ausentes",
  "Justificados",
  "% Asistencia",
  "% Ausencia",
  "Estado",
] as const;

/** ATT-01 roll sheet, exported client-side from the on-screen state (07 §4.1). */
export const ATTENDANCE_ROLL_CSV_HEADERS = ["Estudiante", "Estado", "Observación"] as const;

/** OBS-01 export (08 §4.1); the API writes the full text, the 100-char cut is a web concern. */
export const OBSERVATION_CSV_HEADERS = [
  "Fecha",
  "Estudiante",
  "Grado",
  "Tipo",
  "Categoría",
  "Descripción",
  "Compromisos",
  "Autor",
  "Notificada",
] as const;
