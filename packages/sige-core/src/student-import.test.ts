import { describe, expect, test } from "bun:test";

import {
  parseImportBirthDate,
  parseImportGender,
  resolveStudentImportHeaders,
  STUDENT_IMPORT_COLUMNS,
  validateStudentImportRows,
} from "./student-import";
import type { StudentImportContext, StudentImportRawRow } from "./student-import";

const NOW = new Date("2026-10-10T15:00:00Z");

const context: StudentImportContext = {
  campuses: [
    { id: "main", name: "Sede Principal", code: "SP", isMain: true },
    { id: "north", name: "Sede Norte", code: "SN", isMain: false },
  ],
  courses: [
    { id: "c-601-main", name: "6-01", campusId: "main" },
    { id: "c-601-north", name: "6-01", campusId: "north" },
    { id: "c-1001", name: "10-01", campusId: "main" },
    { id: "c-701-north", name: "7-01", campusId: "north" },
  ],
  existingDocuments: new Map([
    ["1001001001", "student"],
    ["2002002002", "user"],
  ]),
  now: NOW,
};

const good = (row: number, extra: Record<string, unknown> = {}): StudentImportRawRow => ({
  row,
  cells: { nombre: "Ana", apellido: "Pérez", documento: `11011011${row}`, ...extra },
});

const messages = (rows: StudentImportRawRow[], ctx: StudentImportContext = context) =>
  validateStudentImportRows(rows, ctx).errors.map((error) => error.message);

const only = (extra: Record<string, unknown>) => messages([good(2, extra)]);

describe("resolveStudentImportHeaders (STU-R8)", () => {
  test("maps spec names case and accent insensitively, singular and plural", () => {
    const { indexByField, missing } = resolveStudentImportHeaders([
      "Nombres",
      "APELLIDO",
      "Documento",
      "Tipo Documento",
      "Fecha_Nacimiento",
      "Género",
      "Grado",
      "Sede",
      "Acudiente",
      "Teléfono Acudiente",
      "Email_Acudiente",
      "Dirección",
      "Barrio",
      "Estrato",
      "Tipo de Sangre",
      "EPS",
      "columna extra",
    ]);
    expect(missing).toEqual([]);
    expect(indexByField).toEqual({
      nombre: 0,
      apellido: 1,
      documento: 2,
      tipo_documento: 3,
      fecha_nacimiento: 4,
      genero: 5,
      grado: 6,
      sede: 7,
      acudiente: 8,
      telefono_acudiente: 9,
      email_acudiente: 10,
      direccion: 11,
      barrio: 12,
      estrato: 13,
      tipo_sangre: 14,
      eps: 15,
    });
  });
  test("reports missing required columns in spec order", () => {
    expect(resolveStudentImportHeaders(["grado", 42, null]).missing).toEqual([
      "nombre",
      "apellido",
      "documento",
    ]);
  });
  test("the column catalogue marks exactly nombre, apellido and documento as required", () => {
    expect(STUDENT_IMPORT_COLUMNS.filter((column) => column.required).map((c) => c.field)).toEqual([
      "nombre",
      "apellido",
      "documento",
    ]);
    expect(STUDENT_IMPORT_COLUMNS).toHaveLength(16);
  });
});

describe("parseImportBirthDate", () => {
  test.each([
    ["2014-03-09", "2014-03-09"],
    ["09/03/2014", "2014-03-09"],
    ["9/3/2014", "2014-03-09"],
    [41707, "2014-03-09"],
    [41707.75, "2014-03-09"],
    [new Date(Date.UTC(2014, 2, 9)), "2014-03-09"],
    [{ result: new Date(Date.UTC(2014, 2, 9)) }, "2014-03-09"],
    ["", undefined],
    [null, undefined],
    [undefined, undefined],
  ])("%p -> %p", (raw, expected) => {
    expect(parseImportBirthDate(raw)).toEqual({ ok: true, value: expected });
  });
  test.each([["2014-02-30"], ["31/02/2014"], ["2014/03/09"], ["ayer"], [-3], [new Date("x")]])(
    "%p is invalid",
    (raw) => {
      expect(parseImportBirthDate(raw)).toEqual({ ok: false });
    },
  );
});

describe("parseImportGender", () => {
  test.each([
    ["M", "M"],
    ["m", "M"],
    ["Masculino", "M"],
    ["F", "F"],
    ["femenino", "F"],
    ["FEMENINO", "F"],
    ["Otro", "Otro"],
    ["otro", "Otro"],
  ])("%p -> %p", (raw, expected) => {
    expect(parseImportGender(raw)).toBe(expected as "M" | "F" | "Otro");
  });
  test("unknown tokens are null", () => {
    expect(parseImportGender("X")).toBeNull();
  });
});

describe("validateStudentImportRows (STU-R8)", () => {
  test("a minimal row defaults to TI, the main campus and no course", () => {
    const { total, valid, errors } = validateStudentImportRows([good(2)], context);
    expect(errors).toEqual([]);
    expect(total).toBe(1);
    expect(valid).toEqual([
      {
        row: 2,
        firstName: "Ana",
        lastName: "Pérez",
        documentType: "TI",
        documentNumber: "110110112",
        campusId: "main",
        courseId: null,
      },
    ]);
  });

  test("a full row maps every optional column", () => {
    const { valid, errors } = validateStudentImportRows(
      [
        good(2, {
          tipo_documento: "rc",
          fecha_nacimiento: "09/03/2014",
          genero: "Femenino",
          grado: "10-01",
          acudiente: "Rosa Pérez",
          telefono_acudiente: 3001234567,
          email_acudiente: "Rosa@Correo.COM",
          direccion: "Calle 1 # 2-3",
          barrio: "El Centro",
          estrato: 3,
          tipo_sangre: "O+",
          eps: "Sanitas",
        }),
      ],
      context,
    );
    expect(errors).toEqual([]);
    expect(valid[0]).toEqual({
      row: 2,
      firstName: "Ana",
      lastName: "Pérez",
      documentType: "RC",
      documentNumber: "110110112",
      birthDate: "2014-03-09",
      gender: "F",
      campusId: "main",
      courseId: "c-1001",
      guardianName: "Rosa Pérez",
      guardianPhone: "3001234567",
      guardianEmail: "rosa@correo.com",
      address: "Calle 1 # 2-3",
      neighborhood: "El Centro",
      stratum: 3,
      bloodType: "O+",
      eps: "Sanitas",
    });
  });

  test("required-field messages", () => {
    expect(only({ documento: "" })).toEqual(["Fila 2: Falta el documento."]);
    expect(only({ nombre: " " })).toEqual(["Fila 2: Falta el nombre."]);
    expect(only({ apellido: undefined })).toEqual(["Fila 2: Falta el apellido."]);
  });

  test("document format", () => {
    expect(only({ documento: "1234" })).toEqual([
      "Fila 2: El documento debe tener al menos 5 dígitos.",
    ]);
    expect(only({ documento: "12.345.678" })).toEqual(['Fila 2: Documento inválido "12.345.678".']);
  });

  test("existing documents are reported per kind (case-insensitive lookup)", () => {
    expect(only({ documento: "1001001001" })).toEqual([
      "Fila 2: Ya existe un estudiante con este documento.",
    ]);
    expect(only({ documento: "2002002002" })).toEqual([
      "Fila 2: Ya existe un usuario con este documento.",
    ]);
    const ctx = { ...context, existingDocuments: new Map([["AB12345", "user" as const]]) };
    expect(messages([good(2, { documento: "ab12345" })], ctx)).toEqual([
      "Fila 2: Ya existe un usuario con este documento.",
    ]);
  });

  test("document type: TI, RC, CC only", () => {
    expect(only({ tipo_documento: "CE" })).toEqual(['Fila 2: Tipo de documento inválido "CE".']);
    expect(only({ tipo_documento: "Pasaporte" })).toEqual([
      'Fila 2: Tipo de documento inválido "Pasaporte".',
    ]);
    const { valid } = validateStudentImportRows([good(2, { tipo_documento: "cc" })], context);
    expect(valid[0]?.documentType).toBe("CC");
  });

  test("course resolution within the current year", () => {
    expect(only({ grado: "11-01" })).toEqual(['Fila 2: El grado "11-01" no existe.']);
    expect(only({ grado: "6-01" })).toEqual([
      'Fila 2: El grado "6-01" es ambiguo; indique la sede.',
    ]);
    const { valid } = validateStudentImportRows(
      [good(2, { grado: "6-01", sede: "sede norte" }), good(3, { grado: "7-01" })],
      context,
    );
    expect(valid.map((c) => [c.courseId, c.campusId])).toEqual([
      ["c-601-north", "north"],
      ["c-701-north", "north"],
    ]);
  });

  test("campus by name or code; the course must belong to it", () => {
    expect(only({ sede: "Sede Sur" })).toEqual(['Fila 2: La sede "Sede Sur" no existe.']);
    const { valid } = validateStudentImportRows([good(2, { sede: "sn" })], context);
    expect(valid[0]).toMatchObject({ campusId: "north", courseId: null });
    expect(only({ grado: "10-01", sede: "SN" })).toEqual([
      "Fila 2: El grado no pertenece a la sede seleccionada.",
    ]);
  });

  test("without a main campus and without sede or grado the row needs a campus", () => {
    const ctx = { ...context, campuses: context.campuses.map((c) => ({ ...c, isMain: false })) };
    expect(messages([good(2)], ctx)).toEqual(["Fila 2: Debes seleccionar una sede."]);
  });

  test("stratum, gender, email and birth date", () => {
    for (const estrato of [0, 7, "3.5", "alto"]) {
      expect(only({ estrato })).toEqual(["Fila 2: El estrato debe estar entre 1 y 6."]);
    }
    expect(only({ genero: "X" })).toEqual(['Fila 2: Género inválido "X".']);
    expect(only({ email_acudiente: "rosa@" })).toEqual(["Fila 2: Ingresa un correo válido."]);
    expect(only({ fecha_nacimiento: "2027-01-01" })).toEqual([
      "Fila 2: La fecha de nacimiento no puede ser futura.",
    ]);
    expect(only({ fecha_nacimiento: "30/02/2014" })).toEqual([
      'Fila 2: Fecha de nacimiento inválida "30/02/2014".',
    ]);
  });

  test("length limits and unreadable cells", () => {
    expect(only({ nombre: "a".repeat(101) })).toEqual([
      "Fila 2: El nombre no puede superar 100 caracteres.",
    ]);
    expect(only({ tipo_sangre: "AB+pos" })).toEqual([
      'Fila 2: La columna "tipo_sangre" no puede superar 5 caracteres.',
    ]);
    expect(only({ barrio: { error: "#REF!" } })).toEqual([
      'Fila 2: Valor no admitido en la columna "barrio".',
    ]);
  });

  test("in-file duplicate documents: first occurrence wins, blank rows ignored", () => {
    const result = validateStudentImportRows(
      [
        good(2, { documento: "5555555" }),
        { row: 3, cells: { nombre: "", apellido: null } },
        good(4, { documento: "5555555" }),
      ],
      context,
    );
    expect(result.total).toBe(2);
    expect(result.valid.map((c) => c.row)).toEqual([2]);
    expect(result.errors).toEqual([
      { row: 4, message: 'Fila 4: El documento "5555555" está repetido en el archivo.' },
    ]);
  });

  test("a row in error does not claim its document", () => {
    const result = validateStudentImportRows(
      [good(2, { documento: "5555555", genero: "X" }), good(3, { documento: "5555555" })],
      context,
    );
    expect(result.valid.map((c) => c.row)).toEqual([3]);
  });
});
