import { describe, expect, test } from "bun:test";

import {
  IMPORT_ROLES,
  importErrorMessages,
  isValidDocumentNumber,
  isValidEmail,
  MAX_IMPORT_ERRORS,
  normalizeHeader,
  parseImportRole,
  resolveImportHeaders,
  validateImportRows,
} from "./user-import";
import type { ImportRawRow } from "./user-import";

const good = (row: number, extra: Record<string, unknown> = {}): ImportRawRow => ({
  row,
  cells: {
    nombres: "María",
    apellidos: "Londoño",
    documento: `110123450${row}`,
    rol: "profesor",
    ...extra,
  },
});

describe("normalizeHeader", () => {
  test.each([
    ["Nombres", "nombres"],
    ["  TIPO_DOCUMENTO ", "tipo_documento"],
    ["Tipo Documento", "tipo_documento"],
    ["tipo-documento", "tipo_documento"],
    ["Teléfono", "telefono"],
    ["CORREO", "correo"],
    ["Número   Documento", "numero_documento"],
    ["", ""],
  ])("%p -> %p", (raw, expected) => {
    expect(normalizeHeader(raw)).toBe(expected);
  });
});

describe("resolveImportHeaders (USR-R11)", () => {
  test("maps spec columns by position, case and accent insensitive", () => {
    const result = resolveImportHeaders([
      "Nombres",
      "APELLIDOS",
      "Tipo_Documento",
      "Documento",
      "Rol",
      "Correo",
      "Teléfono",
    ]);
    expect(result.missing).toEqual([]);
    expect(result.indexByField).toEqual({
      nombres: 0,
      apellidos: 1,
      tipo_documento: 2,
      documento: 3,
      rol: 4,
      correo: 5,
      telefono: 6,
    });
  });

  test("accepts aliases and ignores unknown columns", () => {
    const result = resolveImportHeaders(["Nombre", "Apellido", "Número de documento", "Role", "x"]);
    expect(result.missing).toEqual([]);
    expect(result.indexByField).toMatchObject({ nombres: 0, apellidos: 1, documento: 2, rol: 3 });
    expect(result.indexByField.correo).toBeUndefined();
  });

  test("reports missing required columns in spec order", () => {
    expect(resolveImportHeaders(["correo", "telefono"]).missing).toEqual([
      "nombres",
      "apellidos",
      "documento",
      "rol",
    ]);
  });

  test("first occurrence wins when a column repeats", () => {
    const result = resolveImportHeaders(["nombres", "nombres", "apellidos", "documento", "rol"]);
    expect(result.indexByField.nombres).toBe(0);
  });

  test("non-string header cells are tolerated", () => {
    const result = resolveImportHeaders([null, 12, undefined, "nombres"]);
    expect(result.indexByField.nombres).toBe(3);
  });
});

describe("parseImportRole (USR-R11, D11)", () => {
  test.each([
    ["coordinador", "coordinator"],
    ["profesor", "teacher"],
    ["estudiante", "student"],
    ["acudiente", "parent"],
    ["consulta", "viewer"],
    ["coordinator", "coordinator"],
    ["teacher", "teacher"],
    ["student", "student"],
    ["parent", "parent"],
    ["viewer", "viewer"],
    ["  PROFESOR ", "teacher"],
    ["Coordinador", "coordinator"],
  ] as const)("%p -> %p", (raw, expected) => {
    expect(parseImportRole(raw)).toBe(expected);
  });

  test.each(["admin", "owner", "administrador", "member", "docente", "", "   "])(
    "%p is rejected",
    (raw) => {
      expect(parseImportRole(raw)).toBeNull();
    },
  );

  test("IMPORT_ROLES never contains admin or owner", () => {
    expect(IMPORT_ROLES).toEqual(["coordinator", "teacher", "student", "parent", "viewer"]);
  });
});

describe("isValidDocumentNumber (D1)", () => {
  test.each([
    ["12345", true],
    ["1234", false],
    ["", false],
    ["AB123", true],
    ["12345678901234567890", true],
    ["123456789012345678901", false],
    ["1234-5678", false],
    ["12 345", false],
    ["12345.0", false],
  ])("%p -> %p", (value, expected) => {
    expect(isValidDocumentNumber(value)).toBe(expected);
  });
});

describe("isValidEmail", () => {
  test.each([
    ["maria@colegio.edu.co", true],
    ["a@b.co", true],
    ["maria", false],
    ["maria@", false],
    ["@colegio.co", false],
    ["maria@colegio", false],
    ["ma ria@colegio.co", false],
    ["", false],
  ])("%p -> %p", (value, expected) => {
    expect(isValidEmail(value)).toBe(expected);
  });
});

describe("validateImportRows", () => {
  test("a valid row is normalised", () => {
    const result = validateImportRows([
      good(2, { correo: " Maria@Colegio.EDU.co ", telefono: "3001234567", tipo_documento: "ce" }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.total).toBe(1);
    expect(result.valid).toEqual([
      {
        row: 2,
        firstName: "María",
        lastName: "Londoño",
        documentType: "CE",
        documentNumber: "1101234502",
        role: "teacher",
        email: "maria@colegio.edu.co",
        phone: "3001234567",
      },
    ]);
  });

  test("document type defaults to CC; optional fields are omitted when blank", () => {
    const [row] = validateImportRows([
      good(2, { correo: "  ", telefono: "", tipo_documento: "" }),
    ]).valid;
    expect(row?.documentType).toBe("CC");
    expect(row?.email).toBeUndefined();
    expect(row?.phone).toBeUndefined();
  });

  test.each([
    ["cc", "CC"],
    ["TI", "TI"],
    ["rc", "RC"],
    ["Ce", "CE"],
    ["pasaporte", "Pasaporte"],
    ["PASAPORTE", "Pasaporte"],
  ] as const)("document type %p -> %p", (raw, expected) => {
    expect(validateImportRows([good(2, { tipo_documento: raw })]).valid[0]?.documentType).toBe(
      expected,
    );
  });

  test("numeric Excel cells become strings", () => {
    const result = validateImportRows([good(2, { documento: 1101234501, telefono: 3001234567 })]);
    expect(result.valid[0]?.documentNumber).toBe("1101234501");
    expect(result.valid[0]?.phone).toBe("3001234567");
  });

  test("a non-integer numeric document is invalid", () => {
    expect(validateImportRows([good(3, { documento: 12345.5 })]).errors[0]?.message).toBe(
      'Fila 3: Valor no admitido en la columna "documento".',
    );
  });

  test.each([
    [{ documento: "" }, "Fila 4: Falta el documento."],
    [{ documento: undefined }, "Fila 4: Falta el documento."],
    [{ documento: null }, "Fila 4: Falta el documento."],
    [{ nombres: "  " }, "Fila 4: Falta el nombre."],
    [{ apellidos: "" }, "Fila 4: Falta el apellido."],
    [{ rol: "" }, "Fila 4: Falta el rol."],
    [{ rol: "director" }, 'Fila 4: Rol inválido "director".'],
    [{ rol: "admin" }, 'Fila 4: Rol inválido "admin".'],
    [{ rol: "owner" }, 'Fila 4: Rol inválido "owner".'],
    [{ correo: "no-es-correo" }, 'Fila 4: Correo inválido "no-es-correo".'],
    [{ tipo_documento: "DNI" }, 'Fila 4: Tipo de documento inválido "DNI".'],
    [{ documento: "123" }, 'Fila 4: Documento inválido "123".'],
    [{ documento: "12-345-678" }, 'Fila 4: Documento inválido "12-345-678".'],
    [{ nombres: "x".repeat(101) }, "Fila 4: El nombre no puede superar 100 caracteres."],
    [{ apellidos: "x".repeat(101) }, "Fila 4: El apellido no puede superar 100 caracteres."],
    [{ telefono: "1".repeat(31) }, "Fila 4: El teléfono no puede superar 30 caracteres."],
  ])("row error %j -> %p", (override, message) => {
    const result = validateImportRows([good(4, override)]);
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([{ row: 4, message }]);
  });

  test("boundary lengths are accepted", () => {
    const result = validateImportRows([
      good(2, {
        nombres: "x".repeat(100),
        apellidos: "y".repeat(100),
        telefono: "1".repeat(30),
        documento: "1".repeat(20),
      }),
    ]);
    expect(result.errors).toEqual([]);
  });

  test("reports one message per row: the first failing rule", () => {
    const result = validateImportRows([
      { row: 5, cells: { nombres: "", apellidos: "", documento: "", rol: "zzz" } },
    ]);
    expect(result.errors).toEqual([{ row: 5, message: "Fila 5: Falta el documento." }]);
  });

  test("fully blank rows are ignored and not counted", () => {
    const result = validateImportRows([
      { row: 2, cells: {} },
      { row: 3, cells: { nombres: "  ", documento: null } },
      good(4),
    ]);
    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  test("duplicate document inside the file flags the later row only", () => {
    const result = validateImportRows([
      good(2, { documento: "ABC12345" }),
      good(3, { documento: "abc12345" }),
      good(4, { documento: "ABC12345" }),
    ]);
    expect(result.valid.map((row) => row.row)).toEqual([2]);
    expect(result.errors).toEqual([
      { row: 3, message: 'Fila 3: El documento "abc12345" está repetido en el archivo.' },
      { row: 4, message: 'Fila 4: El documento "ABC12345" está repetido en el archivo.' },
    ]);
  });

  test("duplicate email inside the file (case-insensitive) flags the later row", () => {
    const result = validateImportRows([
      good(2, { correo: "a@b.co" }),
      good(3, { correo: "A@B.co" }),
    ]);
    expect(result.valid.map((row) => row.row)).toEqual([2]);
    expect(result.errors).toEqual([
      { row: 3, message: 'Fila 3: El correo "A@B.co" está repetido en el archivo.' },
    ]);
  });

  test("an invalid row does not reserve its document", () => {
    const result = validateImportRows([
      good(2, { documento: "11111", rol: "nope" }),
      good(3, { documento: "11111" }),
    ]);
    expect(result.valid.map((row) => row.row)).toEqual([3]);
    expect(result.errors).toHaveLength(1);
  });

  test("errors keep file order and every row is classified exactly once", () => {
    const rows = [good(2), good(3, { rol: "x" }), good(4), good(5, { correo: "bad" })];
    const result = validateImportRows(rows);
    expect(result.total).toBe(4);
    expect(result.valid.length + result.errors.length).toBe(4);
    expect(result.errors.map((error) => error.row)).toEqual([3, 5]);
  });
});

describe("importErrorMessages (server-side collisions)", () => {
  test("verbatim USR-R11 messages", () => {
    expect(importErrorMessages.documentExists(7, "1101234501")).toBe(
      'Fila 7: El documento "1101234501" ya existe.',
    );
    expect(importErrorMessages.emailInUse(7, "a@b.co")).toBe(
      'Fila 7: El correo "a@b.co" ya está en uso.',
    );
  });
  test("cap constant matches the spec", () => {
    expect(MAX_IMPORT_ERRORS).toBe(200);
  });
});

describe("cell shapes (exceljs)", () => {
  const documentOf = (value: unknown) =>
    validateImportRows([good(2, { documento: value })]).valid[0]?.documentNumber;

  test("hyperlink cells read their text", () => {
    expect(documentOf({ text: "1101234501", hyperlink: "mailto:x@y.co" })).toBe("1101234501");
    const email = validateImportRows([
      good(2, { correo: { text: "Ana@Colegio.co", hyperlink: "mailto:ana@colegio.co" } }),
    ]);
    expect(email.valid[0]?.email).toBe("ana@colegio.co");
  });

  test("rich text cells concatenate their runs", () => {
    expect(documentOf({ richText: [{ text: "11012" }, { text: "34501" }] })).toBe("1101234501");
    const names = validateImportRows([
      good(2, { nombres: { richText: [{ text: "Ma" }, { text: "ría" }] } }),
    ]);
    expect(names.valid[0]?.firstName).toBe("María");
  });

  test("formula cells read their result (also shared formulas)", () => {
    expect(documentOf({ formula: "A1&B1", result: "1101234501" })).toBe("1101234501");
    expect(documentOf({ sharedFormula: "A1", result: 1101234501 })).toBe("1101234501");
  });

  test("a formula without a result is blank", () => {
    const result = validateImportRows([good(2, { documento: { formula: "A1" } })]);
    expect(result.errors).toEqual([{ row: 2, message: "Fila 2: Falta el documento." }]);
  });

  test("date cells read as an ISO date, which fails document validation clearly", () => {
    const result = validateImportRows([good(2, { documento: new Date("2024-03-05T00:00:00Z") })]);
    expect(result.errors).toEqual([
      { row: 2, message: 'Fila 2: Documento inválido "2024-03-05".' },
    ]);
  });

  test("safe integers render without exponent", () => {
    expect(documentOf(9007199254740991)).toBe("9007199254740991");
    expect(validateImportRows([good(2, { telefono: -0 })]).valid[0]?.phone).toBe("0");
  });

  test.each([
    ["a fraction", 12.5],
    ["an unsafe integer", 1e21],
    ["a beyond-safe integer", Number.MAX_SAFE_INTEGER + 2],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("%s is rejected with a row error instead of being coerced", (_label, value) => {
    const result = validateImportRows([good(4, { telefono: value })]);
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([
      { row: 4, message: 'Fila 4: Valor no admitido en la columna "telefono".' },
    ]);
  });

  test("an error-valued cell is rejected; a row with only a bad number is not blank", () => {
    expect(validateImportRows([good(3, { correo: { error: "#N/A" } })]).errors[0]?.message).toBe(
      'Fila 3: Valor no admitido en la columna "correo".',
    );
    const onlyBad = validateImportRows([{ row: 5, cells: { documento: 1e21 } }]);
    expect(onlyBad.total).toBe(1);
    expect(onlyBad.errors).toEqual([
      { row: 5, message: 'Fila 5: Valor no admitido en la columna "documento".' },
    ]);
  });
});

describe("email normalisation", () => {
  test("is trimmed and lowercased before validation", () => {
    const result = validateImportRows([good(2, { correo: "  MARIA@Colegio.CO  " })]);
    expect(result.errors).toEqual([]);
    expect(result.valid[0]?.email).toBe("maria@colegio.co");
  });

  test("spelling variants of one address are duplicates in the file", () => {
    const result = validateImportRows([
      good(2, { correo: "maria@colegio.co" }),
      good(3, { correo: " MARIA@colegio.co " }),
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toEqual([
      { row: 3, message: 'Fila 3: El correo "MARIA@colegio.co" está repetido en el archivo.' },
    ]);
  });
});
