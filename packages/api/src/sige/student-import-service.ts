import type { AuditLogger } from "@base-template/auth/audit";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import {
  cellText,
  resolveStudentImportHeaders,
  STUDENT_IMPORT_COLUMNS,
  validateStudentImportRows,
} from "@base-template/sige-core";
import type {
  ImportRowError,
  StudentImportCandidate,
  StudentImportRawRow,
} from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { currentAcademicYear } from "./academic-year";
import { recordAudit } from "./audit";
import { createImportJob, executeImportJob } from "./import-job";
import type { ImportJobRunnerPort } from "./import-runner";
import { buildTemplateWorkbook, readWorkbookUpload } from "./import-workbook";
import { CAMPUS_INACTIVE_MESSAGE, importStudent } from "./student-service";
import { PREVIEW_ERRORS, PREVIEW_ROWS } from "./user-import-service";
import type { ImportActor } from "./user-import-service";

/**
 * Student Excel import (sige/05 STU-05, STU-R2 path C, STU-R3, STU-R8) on the shared import
 * pieces: the field-agnostic workbook reader, the `import_job` runner (kind `students`, so one
 * running job per kind and institution, sige/03 USR-R12) and the pure row rules of `sige-core`.
 * `analyzeStudentImport` is the single validation pass of the dry run and the job; each valid row
 * is admitted through `importStudent`, the same one-transaction path A as `student.create`
 * (login, profile, STU-R3 enrollment under the course lock). The job writes one
 * `student.imported` event and no per-student rows (§3.2).
 */

export const STUDENT_IMPORT_TEMPLATE_FILENAME = "plantilla-estudiantes.xlsx";
// Writer-authored (not in the spec).
const ROW_FAILED_MESSAGE = "No se pudo crear el estudiante.";

export type StudentImportAnalysis = {
  /** Non-blank rows examined. */
  total: number;
  valid: StudentImportCandidate[];
  /** Every invalid row, by ascending row number (not capped here). */
  errors: ImportRowError[];
};

/** Upload gate of `student.importPreview`/`importStart`: limits, then the STU-R8 headers. */
export function readStudentImportUpload(file: File): Promise<{ rows: StudentImportRawRow[] }> {
  return readWorkbookUpload(file, resolveStudentImportHeaders);
}

/** `plantilla-estudiantes.xlsx`: the 16 STU-R8 columns plus one example row. */
export function buildStudentImportTemplate(): Promise<Uint8Array> {
  const example: Record<(typeof STUDENT_IMPORT_COLUMNS)[number]["field"], unknown> = {
    nombre: "Laura",
    apellido: "Pérez Gómez",
    documento: "1012345678",
    tipo_documento: "TI",
    fecha_nacimiento: "2014-05-20",
    genero: "F",
    grado: "6-01",
    sede: "Principal",
    acudiente: "Ana Gómez",
    telefono_acudiente: "3001234567",
    email_acudiente: "ana.gomez@correo.com",
    direccion: "Calle 10 # 5-20",
    barrio: "Centro",
    estrato: 2,
    tipo_sangre: "O+",
    eps: "Sura",
  };
  const fields = STUDENT_IMPORT_COLUMNS.map((column) => column.field);
  return buildTemplateWorkbook(
    "Estudiantes",
    fields,
    fields.map((field) => example[field]),
  );
}

/**
 * The lookups of `validateStudentImportRows`: active campuses, courses of the current academic
 * year, and the documents of the file already registered in the institution.
 */
async function loadImportContext(
  db: Database,
  organizationId: string,
  rows: readonly StudentImportRawRow[],
) {
  const documents = [
    ...new Set(rows.map((raw) => cellText(raw.cells.documento).toUpperCase()).filter(Boolean)),
  ];
  const year = await currentAcademicYear(db, organizationId);
  const [campuses, courses, existing] = await Promise.all([
    db
      .select({
        id: schema.campus.id,
        name: schema.campus.name,
        code: schema.campus.code,
        isMain: schema.campus.isMain,
      })
      .from(schema.campus)
      .where(and(eq(schema.campus.organizationId, organizationId), eq(schema.campus.active, true))),
    db
      .select({ id: schema.course.id, name: schema.course.name, campusId: schema.course.campusId })
      .from(schema.course)
      .where(
        and(eq(schema.course.organizationId, organizationId), eq(schema.course.academicYear, year)),
      ),
    documents.length === 0
      ? []
      : db
          .select({
            documentNumber: schema.person.documentNumber,
            studentId: schema.student.id,
          })
          .from(schema.person)
          .leftJoin(
            schema.student,
            and(
              eq(schema.student.organizationId, schema.person.organizationId),
              eq(schema.student.personId, schema.person.id),
            ),
          )
          .where(
            and(
              eq(schema.person.organizationId, organizationId),
              inArray(sql<string>`upper(${schema.person.documentNumber})`, documents),
            ),
          ),
  ]);
  return {
    campuses: campuses.map((campus) => ({ ...campus, code: campus.code ?? "" })),
    courses,
    existingDocuments: new Map(
      existing.map((row): [string, "student" | "user"] => [
        row.documentNumber.toUpperCase(),
        row.studentId ? "student" : "user",
      ]),
    ),
  };
}

/** Row validation against the institution's data, errors sorted by row. */
export async function analyzeStudentImport(
  db: Database,
  organizationId: string,
  rows: readonly StudentImportRawRow[],
): Promise<StudentImportAnalysis> {
  const ctx = await loadImportContext(db, organizationId, rows);
  const { total, valid, errors } = validateStudentImportRows(rows, ctx);
  // A course of the year may sit on an inactive campus; admission would refuse it (STU-03 rule).
  const active = new Set(ctx.campuses.map((campus) => campus.id));
  const kept: StudentImportCandidate[] = [];
  const all = [...errors];
  for (const candidate of valid) {
    if (active.has(candidate.campusId)) {
      kept.push(candidate);
    } else {
      all.push({
        row: candidate.row,
        message: `Fila ${candidate.row}: ${CAMPUS_INACTIVE_MESSAGE}`,
      });
    }
  }
  return { total, valid: kept, errors: all.toSorted((a, b) => a.row - b.row) };
}

export type StudentPreviewRow = {
  row: number;
  nombre: string;
  apellido: string;
  documento: string;
  grado: string;
  valid: boolean;
  /** The row's error message, or `null` when valid. */
  message: string | null;
};

/** `student.importPreview` result (sige/05 §3.1): no writes. */
export async function previewStudentImport(
  db: Database,
  organizationId: string,
  rows: readonly StudentImportRawRow[],
) {
  const analysis = await analyzeStudentImport(db, organizationId, rows);
  const messageByRow = new Map(analysis.errors.map((error) => [error.row, error.message]));
  const examined = new Set([
    ...analysis.valid.map((candidate) => candidate.row),
    ...analysis.errors.map((error) => error.row),
  ]);
  const preview: StudentPreviewRow[] = rows
    .filter((raw) => examined.has(raw.row))
    .slice(0, PREVIEW_ROWS)
    .map((raw) => ({
      row: raw.row,
      nombre: cellText(raw.cells.nombre),
      apellido: cellText(raw.cells.apellido),
      documento: cellText(raw.cells.documento),
      grado: cellText(raw.cells.grado),
      valid: !messageByRow.has(raw.row),
      message: messageByRow.get(raw.row) ?? null,
    }));
  return {
    total: analysis.total,
    valid: analysis.valid.length,
    invalid: analysis.errors.length,
    rows: preview,
    errors: analysis.errors.slice(0, PREVIEW_ERRORS),
  };
}

export type StudentImportDeps = {
  db: Database;
  auditLogger: AuditLogger;
  runner: ImportJobRunnerPort;
};

/** Spanish row message for an admission failure; unexpected errors never leak their text. */
function rowFailure(candidate: StudentImportCandidate, error: unknown): string {
  const message = error instanceof ORPCError ? error.message : ROW_FAILED_MESSAGE;
  return `Fila ${candidate.row}: ${message}`;
}

/**
 * Records the `students` job and hands it to the runner. The running-job index (D7) refuses a
 * second student import of the institution with `CONFLICT` "Ya hay una importación en curso.".
 */
export async function startStudentImport(
  deps: StudentImportDeps,
  organizationId: string,
  actor: ImportActor,
  analysis: StudentImportAnalysis,
): Promise<{ jobId: string }> {
  const jobId = await createImportJob(deps.db, {
    organizationId,
    kind: "students",
    createdBy: actor.personId,
    total: analysis.total,
    errors: analysis.errors,
  });
  deps.runner.run(() => runStudentImport(deps, organizationId, actor, jobId, analysis));
  return { jobId };
}

/** Executes a started job. Never rejects: a job failure is recorded as `failed`. */
export function runStudentImport(
  deps: StudentImportDeps,
  organizationId: string,
  actor: ImportActor,
  jobId: string,
  analysis: StudentImportAnalysis,
): Promise<void> {
  const admissionActor = { userId: actor.userId, impersonatorUserId: actor.impersonatorUserId };
  return executeImportJob(deps.db, jobId, analysis, {
    process: async (candidate) => {
      const { row: _row, ...input } = candidate;
      await importStudent(deps.db, organizationId, input, admissionActor);
    },
    failureMessage: rowFailure,
    finish: ({ imported, skipped }) =>
      recordAudit(
        {
          auditLogger: deps.auditLogger,
          org: { id: organizationId },
          session: {
            user: { id: actor.userId },
            session: { impersonatedBy: actor.impersonatorUserId },
          },
        },
        {
          action: "student.imported",
          targetType: "import_job",
          targetId: jobId,
          metadata: { jobId, total: analysis.total, imported, skipped },
        },
      ),
  });
}
