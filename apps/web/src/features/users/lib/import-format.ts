/** The role names accepted in the `rol` column (USR-R11); the table and the note derive from it. */
export const IMPORT_ROLE_NAMES = [
  "coordinador",
  "profesor",
  "estudiante",
  "acudiente",
  "consulta",
] as const;

const IMPORT_ROLES_TEXT = IMPORT_ROLE_NAMES.join(", ");

/** The USR-04 "Formato Requerido" table (USR-R11). Column names are the workbook headers. */
export const IMPORT_COLUMNS: readonly { name: string; required: boolean; values: string }[] = [
  { name: "nombres", required: true, values: "texto" },
  { name: "apellidos", required: true, values: "texto" },
  { name: "tipo_documento", required: false, values: "TI, CC (por defecto), RC, CE, Pasaporte" },
  { name: "documento", required: true, values: "mínimo 5 caracteres; será la contraseña inicial" },
  { name: "rol", required: true, values: IMPORT_ROLES_TEXT },
  { name: "correo", required: false, values: "correo válido" },
  { name: "telefono", required: false, values: "texto" },
];

export const IMPORT_EXAMPLE_ROW = [
  "María",
  "Londoño",
  "CC",
  "1101234501",
  "profesor",
  "maria@colegio.edu.co",
  "3001234567",
] as const;

export const IMPORT_ROLES_NOTE = `Roles válidos: ${IMPORT_ROLES_TEXT}`;

export const IMPORT_STUDENT_NOTE =
  "Para estudiantes con grado y acudiente use «Cargar Estudiantes desde Excel».";
