import type { ImportNoun } from "@/features/imports";

/** `student.importTemplate`'s file name (sige/05 §3.1). */
export const STUDENT_IMPORT_TEMPLATE_FILENAME = "plantilla-estudiantes.xlsx";

/** "{n} estudiantes importados exitosamente" (STU-R8). */
export const STUDENT_IMPORT_NOUN: ImportNoun = { one: "estudiante", other: "estudiantes" };

/** The "Importante" callout of "Subir Archivo" (sige/05 §5.5). */
export const STUDENT_IMPORT_NOTICE =
  "Los estudiantes que ya existen (mismo documento) serán omitidos. La contraseña inicial de cada estudiante es su número de documento. Se generará usuario automáticamente.";
