import { ORPCError } from "@orpc/server";
import ExcelJS from "exceljs";
import { describe, expect, test } from "bun:test";

import {
  IMPORT_TEMPLATE_FILENAME,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  buildImportTemplate,
  readImportUpload,
  readImportWorkbook,
} from "./user-import-file";

/** USR-R12 file limits and the template (sige/03 §3.3): no database involved. */

const HEADER = ["nombres", "apellidos", "tipo_documento", "documento", "rol", "correo", "telefono"];

async function workbookBytes(rows: unknown[][], header: unknown[] = HEADER): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Usuarios");
  sheet.addRow(header);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

const person = (index: number) => [
  "Ana",
  `Pérez${index}`,
  "CC",
  `1100${String(index).padStart(6, "0")}`,
  "profesor",
  "",
  "",
];

const failure = async (work: Promise<unknown>) =>
  work.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const xlsxFile = (bytes: Uint8Array, name = "usuarios.xlsx") => new File([bytes], name);

/** A zip whose central directory only *declares* sizes: enough to exercise the pre-parse guard. */
function declaredZip(entries: { name: string; compressed: number; uncompressed: number }[]) {
  const names = entries.map((entry) => new TextEncoder().encode(entry.name));
  const centralSize = entries.reduce((sum, _, i) => sum + 46 + names[i]!.length, 0);
  const bytes = new Uint8Array(centralSize + 22);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  entries.forEach((entry, i) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint32(offset + 20, entry.compressed, true);
    view.setUint32(offset + 24, entry.uncompressed, true);
    view.setUint16(offset + 28, names[i]!.length, true);
    bytes.set(names[i]!, offset + 46);
    offset += 46 + names[i]!.length;
  });
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, 0, true);
  return bytes;
}

describe("readImportWorkbook", () => {
  test("reads the header-mapped rows with their Excel row numbers", async () => {
    const bytes = await workbookBytes([person(1), person(2)]);
    const { rows } = await readImportWorkbook(bytes);
    expect(rows.map((row) => row.row)).toEqual([2, 3]);
    expect(rows[0]?.cells).toMatchObject({
      nombres: "Ana",
      apellidos: "Pérez1",
      tipo_documento: "CC",
      documento: "1100000001",
      rol: "profesor",
    });
  });

  test("accepts case, accent and alias variants of the header", async () => {
    const bytes = await workbookBytes(
      [["Ana", "Gil", "12345678", "Profesor"]],
      ["Nombre", "APELLIDO", "Número Documento", "Role"],
    );
    const { rows } = await readImportWorkbook(bytes);
    expect(rows[0]?.cells).toMatchObject({
      nombres: "Ana",
      documento: "12345678",
      rol: "Profesor",
    });
  });

  test("a missing required column is a BAD_REQUEST naming it", async () => {
    const bytes = await workbookBytes([["Ana", "Gil"]], ["nombres", "apellidos"]);
    const error = await failure(readImportWorkbook(bytes));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("Faltan columnas obligatorias: documento, rol.");
  });

  test("accepts exactly 2,000 data rows and rejects 2,001", async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => person(i));
    const ok = await readImportWorkbook(await workbookBytes(rows));
    expect(ok.rows).toHaveLength(MAX_IMPORT_ROWS);

    const error = await failure(
      readImportWorkbook(await workbookBytes([...rows, person(MAX_IMPORT_ROWS)])),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El archivo supera el máximo de 2000 filas.");
  });

  test("bytes that are not a zip are not an Excel file", async () => {
    const error = await failure(readImportWorkbook(new TextEncoder().encode("nombres,apellidos")));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El archivo no es un Excel (.xlsx) válido.");
  });

  test("a workbook without sheets or rows has nothing to import", async () => {
    const empty = new ExcelJS.Workbook();
    empty.addWorksheet("Vacía");
    const error = await failure(readImportWorkbook(new Uint8Array(await empty.xlsx.writeBuffer())));
    expect(error?.code).toBe("BAD_REQUEST");
  });
});

describe("zip-bomb guard", () => {
  test("rejects a declared uncompressed size over 50 MB before any parsing", async () => {
    const bytes = declaredZip([
      { name: "xl/worksheets/sheet1.xml", compressed: 4_000_000, uncompressed: 51 * 1024 * 1024 },
    ]);
    const error = await failure(readImportWorkbook(bytes));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El archivo descomprimido es demasiado grande.");
  });

  test("rejects an excessive entry count", async () => {
    const bytes = declaredZip(
      Array.from({ length: 1001 }, (_, i) => ({ name: `e${i}`, compressed: 10, uncompressed: 10 })),
    );
    const error = await failure(readImportWorkbook(bytes));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El archivo contiene demasiados elementos.");
  });

  test("rejects an entry with an excessive compression ratio", async () => {
    const bytes = declaredZip([
      { name: "xl/sharedStrings.xml", compressed: 1000, uncompressed: 5 * 1024 * 1024 },
    ]);
    const error = await failure(readImportWorkbook(bytes));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El archivo tiene una tasa de compresión sospechosa.");
  });

  test("rejects a real workbook that inflates a few KB into megabytes", async () => {
    const bomb = await workbookBytes([["x".repeat(6_000_000), "y", "", "12345678", "profesor"]]);
    expect(bomb.byteLength).toBeLessThan(100_000);
    const error = await failure(readImportWorkbook(bomb));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("El archivo tiene una tasa de compresión sospechosa.");
  });

  test("a normal workbook passes the guard", async () => {
    const { rows } = await readImportWorkbook(await workbookBytes([person(1)]));
    expect(rows).toHaveLength(1);
  });
});

describe("readImportUpload", () => {
  test("rejects other extensions with the spec message", async () => {
    const error = await failure(readImportUpload(xlsxFile(new Uint8Array([1]), "usuarios.csv")));
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("Solo se permiten archivos Excel (.xlsx).");
  });

  test("the extension check is case-insensitive", async () => {
    const bytes = await workbookBytes([person(1)]);
    const { rows } = await readImportUpload(xlsxFile(bytes, "USUARIOS.XLSX"));
    expect(rows).toHaveLength(1);
  });

  test("a file over 10 MB is a 413 with the AUTH-05 copy; exactly 10 MB is not refused for size", async () => {
    const over = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], "grande.xlsx");
    const error = await failure(readImportUpload(over));
    expect(error?.status).toBe(413);
    expect(error?.code).toBe("PAYLOAD_TOO_LARGE");
    expect(error?.message).toBe("El archivo que intentas subir supera el tamaño máximo permitido.");

    const exact = new File([new Uint8Array(MAX_IMPORT_BYTES)], "justo.xlsx");
    const other = await failure(readImportUpload(exact));
    expect(other?.status).not.toBe(413);
  });
});

describe("buildImportTemplate", () => {
  test("has the spec headers and one example row that validates", async () => {
    const bytes = await buildImportTemplate();
    const { rows } = await readImportWorkbook(bytes);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cells).toMatchObject({
      nombres: "María",
      apellidos: "Londoño",
      tipo_documento: "CC",
      documento: "1101234501",
      rol: "profesor",
      correo: "maria@colegio.edu.co",
      telefono: "3001234567",
    });
    expect(IMPORT_TEMPLATE_FILENAME).toBe("plantilla-usuarios.xlsx");
  });
});
