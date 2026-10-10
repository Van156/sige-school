import { describe, expect, test } from "bun:test";

import {
  ATTENDANCE_HISTORY_CSV_HEADERS,
  ATTENDANCE_ROLL_CSV_HEADERS,
  ATTENDANCE_SUMMARY_CSV_HEADERS,
  CSV_BOM,
  CSV_CONTENT_TYPE,
  OBSERVATION_CSV_HEADERS,
  csvBody,
  csvFile,
  escapeCsvCell,
  toCsv,
} from "./csv";
import type { CsvColumn } from "./csv";

type Row = { name: string; note: string | null; count?: number };

const columns: readonly CsvColumn<Row>[] = [
  { header: "Estudiante", value: (row) => row.name },
  { header: "Observación", value: (row) => row.note },
  { header: "Total", value: (row) => row.count },
];

describe("escapeCsvCell (RFC 4180)", () => {
  test("plain text is not quoted", () => {
    expect(escapeCsvCell("Ana")).toBe("Ana");
    expect(escapeCsvCell(7)).toBe("7");
    expect(escapeCsvCell(true)).toBe("true");
  });

  test("null and undefined become empty cells", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  test("commas, quotes and line breaks are quoted, inner quotes doubled", () => {
    expect(escapeCsvCell("Pérez, Ana")).toBe('"Pérez, Ana"');
    expect(escapeCsvCell('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(escapeCsvCell("linea1\r\nlinea2")).toBe('"linea1\r\nlinea2"');
    expect(escapeCsvCell("linea1\nlinea2")).toBe('"linea1\nlinea2"');
  });

  test("accents are left as they are (the BOM makes Excel read them)", () => {
    expect(escapeCsvCell("Observación del niño áéíóúü")).toBe("Observación del niño áéíóúü");
    expect(escapeCsvCell("Pérez Ñáñez, José")).toBe('"Pérez Ñáñez, José"');
  });

  test("formula-leading text is prefixed with an apostrophe (OWASP CSV injection)", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
    expect(escapeCsvCell("\tcmd")).toBe("'\tcmd");
    expect(escapeCsvCell("\rcmd")).toBe('"\'\rcmd"');
  });

  test("real numbers are not text, so they are never guarded", () => {
    expect(escapeCsvCell(-1)).toBe("-1");
  });

  test("dates and objects", () => {
    expect(escapeCsvCell(new Date("2026-10-10T08:00:00.000Z"))).toBe("2026-10-10T08:00:00.000Z");
    expect(escapeCsvCell(new Date(Number.NaN))).toBe("");
    expect(escapeCsvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
});

describe("toCsv (RFC 4180, CRLF)", () => {
  test("a header line and one line per row, each ended by CRLF, no BOM", () => {
    const csv = toCsv([{ name: "Ana", note: null, count: 3 }], columns);
    expect(csv).toBe("Estudiante,Observación,Total\r\nAna,,3\r\n");
    expect(csv.startsWith(CSV_BOM)).toBe(false);
  });

  test("only the header line when there are no rows", () => {
    expect(toCsv([], columns)).toBe("Estudiante,Observación,Total\r\n");
  });

  test("an embedded CRLF stays inside the quoted cell", () => {
    expect(toCsv([{ name: "Ana", note: "linea1\r\nlinea2", count: undefined }], columns)).toBe(
      'Estudiante,Observación,Total\r\nAna,"linea1\r\nlinea2",\r\n',
    );
  });
});

describe("csvBody / csvFile (07 §4.1, 08 §4.1)", () => {
  test("the body starts with the UTF-8 byte order mark", () => {
    const body = csvBody([{ name: "Pérez, Ana", note: 'Dijo "hola"' }], columns);
    expect(body).toBe(
      `${CSV_BOM}Estudiante,Observación,Total\r\n"Pérez, Ana","Dijo ""hola""",\r\n`,
    );
    expect(body.codePointAt(0)).toBe(0xfeff);
  });

  test("the file carries the CSV media type and the body", async () => {
    const rows = [{ name: "Ana", note: null }];
    const file = csvFile("asistencia.csv", rows, columns);
    expect(file.name).toBe("asistencia.csv");
    expect(file.type).toBe(CSV_CONTENT_TYPE);
    expect(CSV_CONTENT_TYPE).toBe("text/csv; charset=utf-8");
    // `Blob.text()` decodes UTF-8 and drops the leading BOM, so the bytes are checked below.
    expect(await file.text()).toBe(toCsv(rows, columns));
    expect(file.size).toBe(new TextEncoder().encode(csvBody(rows, columns)).byteLength);
  });

  test("the file starts with the three BOM bytes", async () => {
    const file = csvFile("x.csv", [{ name: "Ana", note: null }], columns);
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe("Spanish header tuples (07 §4.1, 08 §4.1)", () => {
  test("attendance student history, group/report and client roll sheet", () => {
    expect(ATTENDANCE_HISTORY_CSV_HEADERS).toEqual([
      "Fecha",
      "Asignatura",
      "Estado",
      "Observación",
      "Registrado por",
    ]);
    expect(ATTENDANCE_SUMMARY_CSV_HEADERS).toEqual([
      "Estudiante",
      "Presentes",
      "Ausentes",
      "Justificados",
      "% Asistencia",
      "% Ausencia",
      "Estado",
    ]);
    expect(ATTENDANCE_ROLL_CSV_HEADERS).toEqual(["Estudiante", "Estado", "Observación"]);
  });

  test("observations", () => {
    expect(OBSERVATION_CSV_HEADERS).toEqual([
      "Fecha",
      "Estudiante",
      "Grado",
      "Tipo",
      "Categoría",
      "Descripción",
      "Compromisos",
      "Autor",
      "Notificada",
    ]);
  });

  test("the tuples line up with the header of the built CSV", () => {
    const headers = ATTENDANCE_ROLL_CSV_HEADERS.map((header) => ({
      header,
      value: () => "",
    }));
    expect(toCsv([], headers)).toBe("Estudiante,Estado,Observación\r\n");
  });
});
