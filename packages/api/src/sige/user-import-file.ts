import { cellText, IMPORT_FIELDS, resolveImportHeaders } from "@base-template/sige-core";
import type { ImportField, ImportRawRow } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";

/**
 * Reads the `.xlsx` upload of USR-04 (sige/03 USR-R12) into the raw rows `validateImportRows`
 * expects. Everything that can be refused cheaply is refused before the workbook is parsed:
 * extension, byte size, and a zip-bomb guard that reads only the zip central directory (declared
 * entry count, declared uncompressed sizes and compression ratios), so a hostile archive never
 * reaches the XML parser. Declared sizes are only claims, so `assertBoundedInflation` then
 * inflates every entry itself under a hard byte budget (discarding the output) before the
 * workbook reader ever sees the archive: a central directory that lies cannot make the server
 * inflate more than `MAX_UNCOMPRESSED_BYTES`.
 */

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;
/** USR-R12: declared uncompressed size of the whole archive. */
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
/** A real workbook has a few dozen parts (sheets, styles, rels); this is generous. */
export const MAX_ZIP_ENTRIES = 1000;
/** Entries below this size are exempt from the ratio rule (tiny XML parts compress very well). */
const RATIO_FLOOR_BYTES = 1024 * 1024;
/** Legitimate sheet XML compresses roughly 10-30:1; a bomb is orders of magnitude beyond. */
const MAX_COMPRESSION_RATIO = 100;

export const IMPORT_TEMPLATE_FILENAME = "plantilla-usuarios.xlsx";
export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Messages not quoted by the spec are writer-authored; the first three are spec text.
const EXTENSION_MESSAGE = "Solo se permiten archivos Excel (.xlsx).";
const TOO_LARGE_MESSAGE = "El archivo que intentas subir supera el tamaño máximo permitido.";
const NOT_EXCEL_MESSAGE = "El archivo no es un Excel (.xlsx) válido.";
const TOO_MANY_ROWS_MESSAGE = `El archivo supera el máximo de ${MAX_IMPORT_ROWS} filas.`;
const UNCOMPRESSED_MESSAGE = "El archivo descomprimido es demasiado grande.";
const ENTRIES_MESSAGE = "El archivo contiene demasiados elementos.";
const RATIO_MESSAGE = "El archivo tiene una tasa de compresión sospechosa.";

const badRequest = (message: string) => new ORPCError("BAD_REQUEST", { message });

const EOCD_SIGNATURE = 0x06_05_4b_50;
const CENTRAL_SIGNATURE = 0x02_01_4b_50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_SIZE = 0xff_ff;
const ZIP64_MARKER = 0xff_ff;

const LOCAL_SIGNATURE = 0x04_03_4b_50;
const LOCAL_HEADER_SIZE = 30;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

type ArchiveEntry = { method: number; compressed: number; localOffset: number };

/**
 * Throws when the zip central directory declares an unreasonable archive. No inflating happens;
 * returns the entries so the actual inflation can be bounded afterwards.
 */
function assertSafeArchive(bytes: Uint8Array): ArchiveEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lowest = Math.max(0, bytes.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE);
  let eocd = -1;
  for (let i = bytes.length - EOCD_MIN_SIZE; i >= lowest; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw badRequest(NOT_EXCEL_MESSAGE);
  }
  const entries = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (entries === ZIP64_MARKER || entries > MAX_ZIP_ENTRIES) {
    throw badRequest(ENTRIES_MESSAGE);
  }

  let offset = directoryOffset;
  let total = 0;
  const archiveEntries: ArchiveEntry[] = [];
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw badRequest(NOT_EXCEL_MESSAGE);
    }
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const length =
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    total += uncompressed;
    if (total > MAX_UNCOMPRESSED_BYTES) {
      throw badRequest(UNCOMPRESSED_MESSAGE);
    }
    if (
      uncompressed > RATIO_FLOOR_BYTES &&
      uncompressed > Math.max(compressed, 1) * MAX_COMPRESSION_RATIO
    ) {
      throw badRequest(RATIO_MESSAGE);
    }
    archiveEntries.push({
      method: view.getUint16(offset + 10, true),
      compressed,
      localOffset: view.getUint32(offset + 42, true),
    });
    offset += length;
  }
  return archiveEntries;
}

/**
 * Inflates every entry under a shared byte budget and throws once the bytes actually produced
 * pass `MAX_UNCOMPRESSED_BYTES`, whatever the central directory declared. Output is discarded:
 * this only proves the archive is safe to hand to the workbook reader.
 */
function assertBoundedInflation(bytes: Uint8Array, entries: ArchiveEntry[]): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let remaining = MAX_UNCOMPRESSED_BYTES;
  for (const entry of entries) {
    const header = entry.localOffset;
    if (
      header + LOCAL_HEADER_SIZE > bytes.length ||
      view.getUint32(header, true) !== LOCAL_SIGNATURE
    ) {
      throw badRequest(NOT_EXCEL_MESSAGE);
    }
    const start =
      header +
      LOCAL_HEADER_SIZE +
      view.getUint16(header + 26, true) +
      view.getUint16(header + 28, true);
    const end = start + entry.compressed;
    if (end > bytes.length) {
      throw badRequest(NOT_EXCEL_MESSAGE);
    }
    if (entry.method === METHOD_STORED) {
      remaining -= entry.compressed;
    } else if (entry.method === METHOD_DEFLATE) {
      try {
        // `maxOutputLength` aborts the stream as soon as the budget is exceeded.
        // `Math.max(.., 1)`: a zero limit would be rejected as an invalid option.
        remaining -= inflateRawSync(bytes.subarray(start, end), {
          maxOutputLength: Math.max(remaining, 1),
        }).length;
      } catch (error) {
        const code = (error as { code?: string }).code;
        throw badRequest(
          code === "ERR_BUFFER_TOO_LARGE" ? UNCOMPRESSED_MESSAGE : NOT_EXCEL_MESSAGE,
        );
      }
    } else {
      throw badRequest(NOT_EXCEL_MESSAGE);
    }
    if (remaining < 0) {
      throw badRequest(UNCOMPRESSED_MESSAGE);
    }
  }
}

/** Parses the bytes of an `.xlsx` into the raw rows of its first worksheet (header = row 1). */
export async function readImportWorkbook(bytes: Uint8Array): Promise<{ rows: ImportRawRow[] }> {
  assertBoundedInflation(bytes, assertSafeArchive(bytes));
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw badRequest(NOT_EXCEL_MESSAGE);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw badRequest(NOT_EXCEL_MESSAGE);
  }
  // `actualRowCount` counts rows holding values (header included), not formatted empties.
  if (sheet.actualRowCount - 1 > MAX_IMPORT_ROWS) {
    throw badRequest(TOO_MANY_ROWS_MESSAGE);
  }

  const headerRow = sheet.getRow(1);
  const headers = Array.from({ length: headerRow.cellCount }, (_, i) =>
    cellText(headerRow.getCell(i + 1).value),
  );
  const { indexByField, missing } = resolveImportHeaders(headers);
  if (missing.length > 0) {
    throw badRequest(`Faltan columnas obligatorias: ${missing.join(", ")}.`);
  }

  const rows: ImportRawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    if (number === 1) {
      return;
    }
    const cells: Partial<Record<ImportField, unknown>> = {};
    for (const field of IMPORT_FIELDS) {
      const column = indexByField[field];
      if (column !== undefined) {
        cells[field] = row.getCell(column + 1).value;
      }
    }
    rows.push({ row: number, cells });
  });
  return { rows };
}

/** Upload gate of `importPreview`/`importStart`: extension and size first, then the workbook. */
export async function readImportUpload(file: File): Promise<{ rows: ImportRawRow[] }> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw badRequest(EXTENSION_MESSAGE);
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ORPCError("PAYLOAD_TOO_LARGE", { status: 413, message: TOO_LARGE_MESSAGE });
  }
  return readImportWorkbook(new Uint8Array(await file.arrayBuffer()));
}

/** `plantilla-usuarios.xlsx`: the USR-R11 header row plus one example row. */
export async function buildImportTemplate(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Usuarios");
  sheet.addRow([...IMPORT_FIELDS]);
  sheet.addRow([
    "María",
    "Londoño",
    "CC",
    "1101234501",
    "profesor",
    "maria@colegio.edu.co",
    "3001234567",
  ]);
  sheet.getRow(1).font = { bold: true };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
