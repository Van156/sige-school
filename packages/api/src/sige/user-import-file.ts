import { IMPORT_FIELDS, resolveImportHeaders } from "@base-template/sige-core";
import type { ImportRawRow } from "@base-template/sige-core";

import { buildTemplateWorkbook, readWorkbookRows, readWorkbookUpload } from "./import-workbook";

/**
 * The USR-04 upload (sige/03 USR-R11/R12) on top of the shared, field-agnostic reader of
 * `import-workbook.ts` (limits and zip-bomb guards live there): the user import's header
 * resolver and its template.
 */

export {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  XLSX_CONTENT_TYPE,
} from "./import-workbook";

export const IMPORT_TEMPLATE_FILENAME = "plantilla-usuarios.xlsx";

/** Parses the bytes of an `.xlsx` into the raw user-import rows of its first worksheet. */
export function readImportWorkbook(bytes: Uint8Array): Promise<{ rows: ImportRawRow[] }> {
  return readWorkbookRows(bytes, resolveImportHeaders);
}

/** Upload gate of `user.importPreview`/`importStart`. */
export function readImportUpload(file: File): Promise<{ rows: ImportRawRow[] }> {
  return readWorkbookUpload(file, resolveImportHeaders);
}

/** `plantilla-usuarios.xlsx`: the USR-R11 header row plus one example row. */
export function buildImportTemplate(): Promise<Uint8Array> {
  return buildTemplateWorkbook("Usuarios", IMPORT_FIELDS, [
    "María",
    "Londoño",
    "CC",
    "1101234501",
    "profesor",
    "maria@colegio.edu.co",
    "3001234567",
  ]);
}
