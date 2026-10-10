/**
 * Pure user-field and Excel-import rules (sige/03 §4.1, USR-R11, USR-R12). No framework or I/O
 * imports: the API schemas, the import job and the web preview share one definition of each rule.
 */

/** Identity document types (sige/00 §5.2); the DB enum `document_type` holds the same values. */
export const DOCUMENT_TYPES = ["TI", "CC", "RC", "CE", "Pasaporte"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DEFAULT_DOCUMENT_TYPE: DocumentType = "CC";

/** Roles an institution caller may provision and the import may assign (USR-R3, D11). */
export const IMPORT_ROLES = ["coordinator", "teacher", "student", "parent", "viewer"] as const;
export type ImportRole = (typeof IMPORT_ROLES)[number];

export const DOCUMENT_NUMBER_MIN = 5;
export const DOCUMENT_NUMBER_MAX = 20;
export const NAME_MAX = 100;
export const PHONE_MAX = 30;
/** `import_job.errors` keeps at most this many entries; the exact count lives in `skipped`. */
export const MAX_IMPORT_ERRORS = 200;

/** Alphanumeric, `DOCUMENT_NUMBER_MIN`..`DOCUMENT_NUMBER_MAX` characters (D1). */
export function isValidDocumentNumber(value: string): boolean {
  return (
    value.length >= DOCUMENT_NUMBER_MIN &&
    value.length <= DOCUMENT_NUMBER_MAX &&
    /^[A-Za-z0-9]+$/.test(value)
  );
}

/** Pragmatic address check: one `@`, no spaces, a dotted domain. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

/** Lowercase, accents stripped, runs of spaces, hyphens and underscores collapsed to `_`. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "_");
}

export const IMPORT_FIELDS = [
  "nombres",
  "apellidos",
  "tipo_documento",
  "documento",
  "rol",
  "correo",
  "telefono",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const REQUIRED_IMPORT_FIELDS = ["nombres", "apellidos", "documento", "rol"] as const;

/** Accepted header spellings per field (already normalised); the spec name comes first. */
const HEADER_ALIASES: Record<ImportField, readonly string[]> = {
  nombres: ["nombres", "nombre", "first_name", "firstname"],
  apellidos: ["apellidos", "apellido", "last_name", "lastname"],
  tipo_documento: ["tipo_documento", "tipo_de_documento", "tipodocumento", "document_type"],
  documento: [
    "documento",
    "numero_documento",
    "numero_de_documento",
    "document",
    "document_number",
  ],
  rol: ["rol", "role"],
  correo: ["correo", "correo_electronico", "email"],
  telefono: ["telefono", "celular", "phone"],
};

const FIELD_BY_HEADER = new Map<string, ImportField>(
  IMPORT_FIELDS.flatMap((field) =>
    HEADER_ALIASES[field].map((alias): [string, ImportField] => [alias, field]),
  ),
);

export type ResolvedHeaders = {
  /** Zero-based column index of each recognised field (first occurrence wins). */
  indexByField: Partial<Record<ImportField, number>>;
  /** Required fields absent from the header row, in spec order. */
  missing: ImportField[];
};

/** Maps the header row to fields. Unknown columns are ignored; non-text cells are tolerated. */
export function resolveImportHeaders(headers: readonly unknown[]): ResolvedHeaders {
  const indexByField: Partial<Record<ImportField, number>> = {};
  headers.forEach((header, index) => {
    if (typeof header !== "string") {
      return;
    }
    const field = FIELD_BY_HEADER.get(normalizeHeader(header));
    if (field && indexByField[field] === undefined) {
      indexByField[field] = index;
    }
  });
  const missing = REQUIRED_IMPORT_FIELDS.filter((field) => indexByField[field] === undefined);
  return { indexByField, missing };
}

const ROLE_TOKENS: Record<string, ImportRole> = {
  coordinador: "coordinator",
  profesor: "teacher",
  estudiante: "student",
  acudiente: "parent",
  consulta: "viewer",
  coordinator: "coordinator",
  teacher: "teacher",
  student: "student",
  parent: "parent",
  viewer: "viewer",
};

/** Spanish or English role token (case/accent insensitive); `admin`/`owner` never resolve (D11). */
export function parseImportRole(raw: string): ImportRole | null {
  return ROLE_TOKENS[normalizeHeader(raw)] ?? null;
}

const DOCUMENT_TYPE_BY_KEY = new Map(DOCUMENT_TYPES.map((type) => [type.toLowerCase(), type]));

export type ImportRawRow = {
  /** Excel row number (header = row 1). */
  row: number;
  cells: Partial<Record<ImportField, unknown>>;
};

export type ImportCandidate = {
  row: number;
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  role: ImportRole;
  email?: string;
  phone?: string;
};

export type ImportRowError = { row: number; message: string };

export type ImportValidation = {
  /** Non-blank rows examined. */
  total: number;
  valid: ImportCandidate[];
  errors: ImportRowError[];
};

export type ImportCell = { text: string; invalid: boolean };

const BLANK: ImportCell = { text: "", invalid: false };
const INVALID: ImportCell = { text: "", invalid: true };

/**
 * Reads the text of an exceljs cell value: plain strings, safe integers, dates (ISO day),
 * hyperlinks (`{ text, hyperlink }`), rich text (`{ richText }`) and formulas (`{ result }`).
 * Fractions, unsafe integers, non-finite numbers and error cells are `invalid`, so the row
 * reports a clear error instead of importing `12.5` or `1e+21`.
 */
export function readCell(value: unknown): ImportCell {
  if (typeof value === "string") {
    return { text: value.trim(), invalid: false };
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? { text: String(value), invalid: false } : INVALID;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? INVALID
      : { text: value.toISOString().slice(0, 10), invalid: false };
  }
  if (typeof value !== "object" || value === null) {
    return BLANK;
  }
  if ("error" in value) {
    return INVALID;
  }
  if ("richText" in value && Array.isArray(value.richText)) {
    const runs = value.richText.map((run: unknown) =>
      typeof run === "object" && run !== null && "text" in run && typeof run.text === "string"
        ? run.text
        : "",
    );
    return { text: runs.join("").trim(), invalid: false };
  }
  if ("result" in value) {
    return readCell(value.result);
  }
  if ("text" in value) {
    return readCell(value.text);
  }
  return BLANK;
}

/** Text of an exceljs cell value (see `readCell`); `""` for blank and unreadable cells. */
export const cellText = (value: unknown): string => readCell(value).text;

const prefix = (row: number, message: string) => `Fila ${row}: ${message}`;

/** Messages for collisions only the server can see (existing rows), same wording as the rest. */
export const importErrorMessages = {
  documentExists: (row: number, document: string) =>
    prefix(row, `El documento "${document}" ya existe.`),
  emailInUse: (row: number, email: string) => prefix(row, `El correo "${email}" ya está en uso.`),
};

type RowOutcome = { candidate: ImportCandidate } | { message: string };

function validateRow({ row, cells }: ImportRawRow): RowOutcome {
  const fail = (message: string): RowOutcome => ({ message: prefix(row, message) });
  const unreadable = IMPORT_FIELDS.find((field) => readCell(cells[field]).invalid);
  if (unreadable) {
    return fail(`Valor no admitido en la columna "${unreadable}".`);
  }
  const firstName = cellText(cells.nombres);
  const lastName = cellText(cells.apellidos);
  const documentNumber = cellText(cells.documento);
  const roleRaw = cellText(cells.rol);
  const typeRaw = cellText(cells.tipo_documento);
  const emailRaw = cellText(cells.correo).toLowerCase();
  const phone = cellText(cells.telefono);

  if (!documentNumber) {
    return fail("Falta el documento.");
  }
  if (!firstName) {
    return fail("Falta el nombre.");
  }
  if (!lastName) {
    return fail("Falta el apellido.");
  }
  if (!roleRaw) {
    return fail("Falta el rol.");
  }
  if (firstName.length > NAME_MAX) {
    return fail(`El nombre no puede superar ${NAME_MAX} caracteres.`);
  }
  if (lastName.length > NAME_MAX) {
    return fail(`El apellido no puede superar ${NAME_MAX} caracteres.`);
  }
  if (!isValidDocumentNumber(documentNumber)) {
    return fail(`Documento inválido "${documentNumber}".`);
  }
  const role = parseImportRole(roleRaw);
  if (!role) {
    return fail(`Rol inválido "${roleRaw}".`);
  }
  const documentType = typeRaw
    ? DOCUMENT_TYPE_BY_KEY.get(typeRaw.toLowerCase())
    : DEFAULT_DOCUMENT_TYPE;
  if (!documentType) {
    return fail(`Tipo de documento inválido "${typeRaw}".`);
  }
  if (emailRaw && !isValidEmail(emailRaw)) {
    return fail(`Correo inválido "${emailRaw}".`);
  }
  if (phone.length > PHONE_MAX) {
    return fail(`El teléfono no puede superar ${PHONE_MAX} caracteres.`);
  }

  return {
    candidate: {
      row,
      firstName,
      lastName,
      documentType,
      documentNumber,
      role,
      ...(emailRaw ? { email: emailRaw } : {}),
      ...(phone ? { phone } : {}),
    },
  };
}

/** Whether every cell of the row is empty (such rows are ignored, not reported). */
export const isBlankRow = (row: ImportRawRow) =>
  Object.values(row.cells).every((value) => {
    const cell = readCell(value);
    return cell.text === "" && !cell.invalid;
  });

/**
 * Validates every non-blank row. A row yields at most one message (the first failing rule). The
 * first occurrence of a document or email wins; later repeats inside the file are flagged
 * (case-insensitively, since the DB would otherwise accept both spellings of one person).
 */
export function validateImportRows(rows: readonly ImportRawRow[]): ImportValidation {
  const valid: ImportCandidate[] = [];
  const errors: ImportRowError[] = [];
  const seenDocuments = new Set<string>();
  const seenEmails = new Set<string>();
  let total = 0;

  for (const raw of rows) {
    if (isBlankRow(raw)) {
      continue;
    }
    total += 1;
    const outcome = validateRow(raw);
    if ("message" in outcome) {
      errors.push({ row: raw.row, message: outcome.message });
      continue;
    }
    const { candidate } = outcome;
    if (seenDocuments.has(candidate.documentNumber.toUpperCase())) {
      errors.push({
        row: raw.row,
        message: prefix(
          raw.row,
          `El documento "${candidate.documentNumber}" está repetido en el archivo.`,
        ),
      });
      continue;
    }
    if (candidate.email && seenEmails.has(candidate.email)) {
      errors.push({
        row: raw.row,
        message: prefix(
          raw.row,
          `El correo "${cellText(raw.cells.correo)}" está repetido en el archivo.`,
        ),
      });
      continue;
    }
    seenDocuments.add(candidate.documentNumber.toUpperCase());
    if (candidate.email) {
      seenEmails.add(candidate.email);
    }
    valid.push(candidate);
  }
  return { total, valid, errors };
}
