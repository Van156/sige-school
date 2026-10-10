/**
 * Pure student Excel-import rules (sige/05 STU-R8, R3.21). The caller loads the lookups (active
 * campuses, courses of the current academic year, existing documents); this module maps headers,
 * reads cells and validates rows without I/O so the preview and the import job agree.
 */
import { isFutureDate } from "./dates";
import {
  DEFAULT_STUDENT_DOCUMENT_TYPE,
  isValidStratum,
  STUDENT_DOCUMENT_TYPES,
  STUDENT_FIELD_MAX,
  studentMessages,
} from "./student";
import type { StudentDocumentType } from "./student";
import {
  cellText,
  DOCUMENT_NUMBER_MIN,
  isValidDocumentNumber,
  isValidEmail,
  NAME_MAX,
  normalizeHeader,
  readCell,
} from "./user-import";
import type { ImportRowError } from "./user-import";

export const STUDENT_IMPORT_COLUMNS = [
  { field: "nombre", required: true },
  { field: "apellido", required: true },
  { field: "documento", required: true },
  { field: "tipo_documento", required: false },
  { field: "fecha_nacimiento", required: false },
  { field: "genero", required: false },
  { field: "grado", required: false },
  { field: "sede", required: false },
  { field: "acudiente", required: false },
  { field: "telefono_acudiente", required: false },
  { field: "email_acudiente", required: false },
  { field: "direccion", required: false },
  { field: "barrio", required: false },
  { field: "estrato", required: false },
  { field: "tipo_sangre", required: false },
  { field: "eps", required: false },
] as const;
export type StudentImportField = (typeof STUDENT_IMPORT_COLUMNS)[number]["field"];

const REQUIRED_FIELDS = STUDENT_IMPORT_COLUMNS.filter((column) => column.required).map(
  (column) => column.field,
);

/** Accepted header spellings per field (already normalised); the spec name comes first. */
const HEADER_ALIASES: Record<StudentImportField, readonly string[]> = {
  nombre: ["nombre", "nombres"],
  apellido: ["apellido", "apellidos"],
  documento: ["documento", "numero_documento", "numero_de_documento"],
  tipo_documento: ["tipo_documento", "tipo_de_documento"],
  fecha_nacimiento: ["fecha_nacimiento", "fecha_de_nacimiento"],
  genero: ["genero", "sexo"],
  grado: ["grado", "curso"],
  sede: ["sede"],
  acudiente: ["acudiente", "nombre_acudiente", "nombre_del_acudiente"],
  telefono_acudiente: ["telefono_acudiente", "telefono_del_acudiente"],
  email_acudiente: ["email_acudiente", "correo_acudiente", "email_del_acudiente"],
  direccion: ["direccion"],
  barrio: ["barrio", "vereda", "barrio_vereda", "barrio_/_vereda"],
  estrato: ["estrato"],
  tipo_sangre: ["tipo_sangre", "tipo_de_sangre"],
  eps: ["eps"],
};

const FIELD_BY_HEADER = new Map<string, StudentImportField>(
  STUDENT_IMPORT_COLUMNS.flatMap(({ field }) =>
    HEADER_ALIASES[field].map((alias): [string, StudentImportField] => [alias, field]),
  ),
);

export type StudentResolvedHeaders = {
  indexByField: Partial<Record<StudentImportField, number>>;
  missing: StudentImportField[];
};

/** Maps the header row to fields (first occurrence wins; unknown and non-text cells ignored). */
export function resolveStudentImportHeaders(headers: readonly unknown[]): StudentResolvedHeaders {
  const indexByField: Partial<Record<StudentImportField, number>> = {};
  headers.forEach((header, index) => {
    if (typeof header !== "string") {
      return;
    }
    const field = FIELD_BY_HEADER.get(normalizeHeader(header));
    if (field && indexByField[field] === undefined) {
      indexByField[field] = index;
    }
  });
  return {
    indexByField,
    missing: REQUIRED_FIELDS.filter((field) => indexByField[field] === undefined),
  };
}

/* ------------------------------ Cell parsers ------------------------------ */

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
/** 9999-12-31, the last date Excel represents. */
const EXCEL_SERIAL_MAX = 2_958_465;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function calendarDay(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? isoDay(date)
    : null;
}

export type ParsedDate = { ok: true; value: string | undefined } | { ok: false };

/**
 * `fecha_nacimiento`: `yyyy-mm-dd`, `dd/mm/yyyy` (one-digit day/month accepted), an Excel date
 * cell (exceljs `Date`, read as UTC) or a raw Excel serial (time of day ignored). Blank is absent.
 */
export function parseImportBirthDate(value: unknown): ParsedDate {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: undefined };
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? { ok: false } : { ok: true, value: isoDay(value) };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1 || value > EXCEL_SERIAL_MAX) {
      return { ok: false };
    }
    return { ok: true, value: isoDay(new Date(EXCEL_EPOCH + Math.floor(value) * DAY_MS)) };
  }
  if (typeof value === "object" && "result" in value) {
    return parseImportBirthDate(value.result);
  }
  const cell = readCell(value);
  if (cell.invalid) {
    return { ok: false };
  }
  const text = cell.text;
  if (!text) {
    return { ok: true, value: undefined };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const latin = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const day = iso
    ? calendarDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    : latin
      ? calendarDay(Number(latin[3]), Number(latin[2]), Number(latin[1]))
      : null;
  return day ? { ok: true, value: day } : { ok: false };
}

export type StudentGender = "M" | "F" | "Otro";

const GENDER_TOKENS: Record<string, StudentGender> = {
  m: "M",
  masculino: "M",
  f: "F",
  femenino: "F",
  otro: "Otro",
};

/** M, F, Otro (also Masculino, Femenino), case and accent insensitive. */
export function parseImportGender(raw: string): StudentGender | null {
  return GENDER_TOKENS[normalizeHeader(raw)] ?? null;
}

/* ------------------------------ Row validation ------------------------------ */

export type StudentImportRawRow = {
  /** Excel row number (header = row 1). */
  row: number;
  cells: Partial<Record<StudentImportField, unknown>>;
};

export type StudentImportContext = {
  /** Active campuses of the institution. */
  campuses: readonly { id: string; name: string; code: string; isMain: boolean }[];
  /** Courses of the institution's current academic year. */
  courses: readonly { id: string; name: string; campusId: string }[];
  /**
   * Documents already registered in the institution, keyed upper-case: `student` when the person
   * has a student profile, `user` for any other person.
   */
  existingDocuments: ReadonlyMap<string, "student" | "user">;
  /** Injectable clock for the "not in the future" birth-date rule. */
  now?: Date;
};

export type StudentImportCandidate = {
  row: number;
  firstName: string;
  lastName: string;
  documentType: StudentDocumentType;
  documentNumber: string;
  birthDate?: string;
  gender?: StudentGender;
  campusId: string;
  courseId: string | null;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  address?: string;
  neighborhood?: string;
  stratum?: number;
  bloodType?: string;
  eps?: string;
};

export type StudentImportValidation = {
  total: number;
  valid: StudentImportCandidate[];
  errors: ImportRowError[];
};

const ADDRESS_MAX = 200;

/** Optional text columns: the candidate key and the column limit. */
const TEXT_COLUMNS = [
  ["acudiente", "guardianName", STUDENT_FIELD_MAX.guardianName],
  ["telefono_acudiente", "guardianPhone", STUDENT_FIELD_MAX.guardianPhone],
  ["direccion", "address", ADDRESS_MAX],
  ["barrio", "neighborhood", STUDENT_FIELD_MAX.neighborhood],
  ["tipo_sangre", "bloodType", STUDENT_FIELD_MAX.bloodType],
  ["eps", "eps", STUDENT_FIELD_MAX.eps],
] as const;

const prefix = (row: number, message: string) => `Fila ${row}: ${message}`;

const DOCUMENT_TYPE_BY_KEY = new Map(
  STUDENT_DOCUMENT_TYPES.map((type): [string, StudentDocumentType] => [type.toLowerCase(), type]),
);

type RowOutcome = { candidate: StudentImportCandidate } | { message: string };

type Placement = { campusId: string; courseId: string | null } | { message: string };

/** `sede` by name or code; `grado` by name within the year, disambiguated by `sede`. */
function resolvePlacement(sedeRaw: string, gradoRaw: string, ctx: StudentImportContext): Placement {
  let campusId: string | undefined;
  if (sedeRaw) {
    const key = normalizeHeader(sedeRaw);
    const campus =
      ctx.campuses.find((c) => normalizeHeader(c.name) === key) ??
      ctx.campuses.find((c) => normalizeHeader(c.code) === key);
    if (!campus) {
      return { message: `La sede "${sedeRaw}" no existe.` };
    }
    campusId = campus.id;
  }
  if (gradoRaw) {
    const key = normalizeHeader(gradoRaw);
    const named = ctx.courses.filter((course) => normalizeHeader(course.name) === key);
    if (named.length === 0) {
      return { message: `El grado "${gradoRaw}" no existe.` };
    }
    const matches = campusId ? named.filter((course) => course.campusId === campusId) : named;
    const [course, ...others] = matches;
    if (!course) {
      return { message: studentMessages.courseCampusMismatch };
    }
    if (others.length > 0) {
      return { message: `El grado "${gradoRaw}" es ambiguo; indique la sede.` };
    }
    return { campusId: course.campusId, courseId: course.id };
  }
  campusId ??= ctx.campuses.find((campus) => campus.isMain)?.id;
  // Authored reuse of the §4.1 campus message: no `sede`, no `grado` and no main campus.
  return campusId ? { campusId, courseId: null } : { message: "Debes seleccionar una sede." };
}

function validateRow({ row, cells }: StudentImportRawRow, ctx: StudentImportContext): RowOutcome {
  const fail = (message: string): RowOutcome => ({ message: prefix(row, message) });
  const textFields = STUDENT_IMPORT_COLUMNS.map((column) => column.field).filter(
    (field) => field !== "fecha_nacimiento",
  );
  const unreadable = textFields.find((field) => readCell(cells[field]).invalid);
  if (unreadable) {
    return fail(`Valor no admitido en la columna "${unreadable}".`);
  }
  const firstName = cellText(cells.nombre);
  const lastName = cellText(cells.apellido);
  const documentNumber = cellText(cells.documento);

  if (!documentNumber) {
    return fail("Falta el documento.");
  }
  if (!firstName) {
    return fail("Falta el nombre.");
  }
  if (!lastName) {
    return fail("Falta el apellido.");
  }
  if (documentNumber.length < DOCUMENT_NUMBER_MIN) {
    return fail(`El documento debe tener al menos ${DOCUMENT_NUMBER_MIN} dígitos.`);
  }
  if (!isValidDocumentNumber(documentNumber)) {
    return fail(`Documento inválido "${documentNumber}".`);
  }
  const existing = ctx.existingDocuments.get(documentNumber.toUpperCase());
  if (existing === "student") {
    return fail("Ya existe un estudiante con este documento.");
  }
  if (existing === "user") {
    return fail("Ya existe un usuario con este documento.");
  }
  if (firstName.length > NAME_MAX) {
    return fail(`El nombre no puede superar ${NAME_MAX} caracteres.`);
  }
  if (lastName.length > NAME_MAX) {
    return fail(`El apellido no puede superar ${NAME_MAX} caracteres.`);
  }

  const typeRaw = cellText(cells.tipo_documento);
  const documentType = typeRaw
    ? DOCUMENT_TYPE_BY_KEY.get(typeRaw.toLowerCase())
    : DEFAULT_STUDENT_DOCUMENT_TYPE;
  if (!documentType) {
    return fail(`Tipo de documento inválido "${typeRaw}".`);
  }

  const placement = resolvePlacement(cellText(cells.sede), cellText(cells.grado), ctx);
  if ("message" in placement) {
    return fail(placement.message);
  }

  const stratumRaw = cellText(cells.estrato);
  const stratum = stratumRaw ? Number(stratumRaw) : undefined;
  if (stratum !== undefined && !isValidStratum(stratum)) {
    return fail(studentMessages.stratumRange);
  }

  const genderRaw = cellText(cells.genero);
  const gender = genderRaw ? parseImportGender(genderRaw) : undefined;
  if (gender === null) {
    return fail(`Género inválido "${genderRaw}".`);
  }

  const guardianEmail = cellText(cells.email_acudiente).toLowerCase();
  if (
    guardianEmail &&
    (!isValidEmail(guardianEmail) || guardianEmail.length > STUDENT_FIELD_MAX.guardianEmail)
  ) {
    return fail("Ingresa un correo válido.");
  }

  const birth = parseImportBirthDate(cells.fecha_nacimiento);
  if (!birth.ok) {
    return fail(`Fecha de nacimiento inválida "${cellText(cells.fecha_nacimiento)}".`);
  }
  if (birth.value && isFutureDate(birth.value, ctx.now)) {
    return fail("La fecha de nacimiento no puede ser futura.");
  }

  const optional: Partial<StudentImportCandidate> = {};
  for (const [field, key, max] of TEXT_COLUMNS) {
    const value = cellText(cells[field]);
    if (value.length > max) {
      return fail(`La columna "${field}" no puede superar ${max} caracteres.`);
    }
    if (value) {
      optional[key] = value;
    }
  }

  return {
    candidate: {
      row,
      firstName,
      lastName,
      documentType,
      documentNumber,
      ...(birth.value ? { birthDate: birth.value } : {}),
      ...(gender ? { gender } : {}),
      campusId: placement.campusId,
      courseId: placement.courseId,
      ...optional,
      ...(guardianEmail ? { guardianEmail } : {}),
      ...(stratum !== undefined ? { stratum } : {}),
    },
  };
}

const isBlank = (row: StudentImportRawRow) =>
  Object.values(row.cells).every((value) => {
    const cell = readCell(value);
    return cell.text === "" && !cell.invalid;
  });

/**
 * Validates every non-blank row; each yields at most one message (the first failing rule).
 * Existing documents are reported as row messages (R3.21: skipped). Inside the file the first
 * valid occurrence of a document wins and later ones are flagged (case-insensitively).
 */
export function validateStudentImportRows(
  rows: readonly StudentImportRawRow[],
  ctx: StudentImportContext,
): StudentImportValidation {
  const valid: StudentImportCandidate[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const raw of rows) {
    if (isBlank(raw)) {
      continue;
    }
    total += 1;
    const outcome = validateRow(raw, ctx);
    if ("message" in outcome) {
      errors.push({ row: raw.row, message: outcome.message });
      continue;
    }
    const key = outcome.candidate.documentNumber.toUpperCase();
    if (seen.has(key)) {
      errors.push({
        row: raw.row,
        message: prefix(
          raw.row,
          `El documento "${outcome.candidate.documentNumber}" está repetido en el archivo.`,
        ),
      });
      continue;
    }
    seen.add(key);
    valid.push(outcome.candidate);
  }
  return { total, valid, errors };
}
