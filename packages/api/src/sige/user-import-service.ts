import type { AuditLogger } from "@base-template/auth/audit";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import {
  importErrorMessages,
  isBlankRow,
  cellText,
  MAX_IMPORT_ERRORS,
  validateImportRows,
} from "@base-template/sige-core";
import type { ImportCandidate, ImportRawRow, ImportRowError } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { recordAudit } from "./audit";
import type { ImportJobRunnerPort } from "./import-runner";
import { rethrowDbError } from "./pg-errors";
import { createUser } from "./user-service";
import type { UserCreateInput } from "./user-service";

/**
 * User import execution (sige/03 USR-04, USR-R11/R12, D7). `analyzeUserImport` is the single
 * validation pass shared by the dry run and the job: the pure row rules of `sige-core` plus the
 * collisions only the database can see (existing documents of the institution, emails taken
 * anywhere). `startUserImport` records the job and hands the work to the runner port; the job
 * provisions every valid row through the shared `createUser` (so USR-R3/R4 and D11 hold), with
 * concurrency 4 and progress persisted every 25 rows.
 */

export const IMPORT_CONCURRENCY = 4;
export const IMPORT_PROGRESS_EVERY = 25;
export const PREVIEW_ROWS = 50;
export const PREVIEW_ERRORS = 200;
export const IMPORT_RUNNING_MESSAGE = "Ya hay una importación en curso.";
export const IMPORT_INTERRUPTED_MESSAGE = "Importación interrumpida";
// Writer-authored (not in the spec).
export const IMPORT_FAILED_MESSAGE = "No se pudo completar la importación.";
export const NO_VALID_ROWS_MESSAGE = "El archivo no contiene filas válidas para importar.";
const ROW_FAILED_MESSAGE = "No se pudo crear el usuario.";

export type ImportAnalysis = {
  /** Non-blank rows examined. */
  total: number;
  valid: ImportCandidate[];
  /** Every invalid row, by ascending row number (not capped here). */
  errors: ImportRowError[];
};

const rowMessage = (row: number, message: string) => `Fila ${row}: ${message}`;

/** Row validation plus the collisions with existing users, errors sorted by row. */
export async function analyzeUserImport(
  db: Database,
  organizationId: string,
  rows: readonly ImportRawRow[],
): Promise<ImportAnalysis> {
  const { total, valid, errors } = validateImportRows(rows);
  const documents = valid.map((candidate) => candidate.documentNumber);
  const emails = valid.flatMap((candidate) => (candidate.email ? [candidate.email] : []));
  const [takenDocuments, takenEmails] = await Promise.all([
    documents.length === 0
      ? []
      : db
          .select({ documentNumber: schema.person.documentNumber })
          .from(schema.person)
          .where(
            and(
              eq(schema.person.organizationId, organizationId),
              inArray(schema.person.documentNumber, documents),
            ),
          ),
    // Emails are globally unique (USR-R5): the message only says "in use", never where.
    emails.length === 0
      ? []
      : db
          .select({ email: schema.user.email })
          .from(schema.user)
          .where(inArray(schema.user.email, emails)),
  ]);
  const documentSet = new Set(takenDocuments.map((row) => row.documentNumber));
  const emailSet = new Set(takenEmails.map((row) => row.email));

  const kept: ImportCandidate[] = [];
  const all = [...errors];
  for (const candidate of valid) {
    if (documentSet.has(candidate.documentNumber)) {
      all.push({
        row: candidate.row,
        message: importErrorMessages.documentExists(candidate.row, candidate.documentNumber),
      });
    } else if (candidate.email && emailSet.has(candidate.email)) {
      all.push({
        row: candidate.row,
        message: importErrorMessages.emailInUse(candidate.row, candidate.email),
      });
    } else {
      kept.push(candidate);
    }
  }
  return { total, valid: kept, errors: all.toSorted((a, b) => a.row - b.row) };
}

export type PreviewRow = {
  row: number;
  nombres: string;
  apellidos: string;
  documento: string;
  rol: string;
  valid: boolean;
  /** The row's error message, or `null` when valid. */
  message: string | null;
};

/** `user.importPreview` result (sige/03 §3.3): no writes. */
export async function previewUserImport(
  db: Database,
  organizationId: string,
  rows: readonly ImportRawRow[],
) {
  const analysis = await analyzeUserImport(db, organizationId, rows);
  const messageByRow = new Map(analysis.errors.map((error) => [error.row, error.message]));
  const preview: PreviewRow[] = rows
    .filter((raw) => !isBlankRow(raw))
    .slice(0, PREVIEW_ROWS)
    .map((raw) => ({
      row: raw.row,
      nombres: cellText(raw.cells.nombres),
      apellidos: cellText(raw.cells.apellidos),
      documento: cellText(raw.cells.documento),
      rol: cellText(raw.cells.rol),
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

export type ImportActor = {
  userId: string;
  /** `person.id` of the caller: the job's creator. */
  personId: string;
  impersonatorUserId: string | null;
};

export type ImportDeps = { db: Database; auditLogger: AuditLogger; runner: ImportJobRunnerPort };

/** Provisions one candidate; throws on failure. The default goes through `createUser`. */
export type ProvisionRow = (candidate: ImportCandidate) => Promise<unknown>;

export type ImportRunInput = ImportAnalysis & { provision?: ProvisionRow };

/** Imports never write per-user audit events (sige/03 §3.5): one `user.imported` per job instead. */
const silentAuditLogger: AuditLogger = { record: () => Promise.resolve() };

function defaultProvision(
  deps: Pick<ImportDeps, "db">,
  organizationId: string,
  actor: ImportActor,
): ProvisionRow {
  return (candidate) =>
    createUser(
      { db: deps.db, auditLogger: silentAuditLogger },
      organizationId,
      {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        documentType: candidate.documentType,
        documentNumber: candidate.documentNumber,
        role: candidate.role,
        email: candidate.email,
        phone: candidate.phone,
      } as UserCreateInput,
      { userId: actor.userId, impersonatorUserId: actor.impersonatorUserId, platform: false },
    );
}

/** Spanish row message for a provisioning failure; unexpected errors never leak their text. */
function rowFailure(candidate: ImportCandidate, error: unknown): string {
  if (error instanceof ORPCError) {
    if (error.code === "CONFLICT" && /documento/i.test(error.message)) {
      return importErrorMessages.documentExists(candidate.row, candidate.documentNumber);
    }
    if (error.code === "CONFLICT" && /correo/i.test(error.message) && candidate.email) {
      return importErrorMessages.emailInUse(candidate.row, candidate.email);
    }
    return rowMessage(candidate.row, error.message);
  }
  return rowMessage(candidate.row, ROW_FAILED_MESSAGE);
}

/**
 * Records the job and hands it to the runner. The running-job index (D7) arbitrates two
 * concurrent starts: the loser gets `CONFLICT` "Ya hay una importación en curso.".
 */
export async function startUserImport(
  deps: ImportDeps,
  organizationId: string,
  actor: ImportActor,
  input: ImportRunInput,
): Promise<{ jobId: string }> {
  let jobId: string;
  try {
    const [job] = await deps.db
      .insert(schema.importJob)
      .values({
        organizationId,
        kind: "users",
        total: input.total,
        // Rows rejected by validation are already processed (skipped) when the job starts.
        processed: input.errors.length,
        skipped: input.errors.length,
        errors: input.errors.slice(0, MAX_IMPORT_ERRORS),
        createdBy: actor.personId,
      })
      .returning({ id: schema.importJob.id });
    jobId = job!.id;
  } catch (error) {
    rethrowDbError(error, "write");
  }
  deps.runner.run(() => runUserImport(deps, organizationId, actor, jobId, input));
  return { jobId };
}

/** Executes a started job. Never rejects for a row or job failure: it records `failed` instead. */
export async function runUserImport(
  deps: ImportDeps,
  organizationId: string,
  actor: ImportActor,
  jobId: string,
  input: ImportRunInput,
): Promise<void> {
  const { db } = deps;
  const provision = input.provision ?? defaultProvision(deps, organizationId, actor);
  const errors = input.errors.slice(0, MAX_IMPORT_ERRORS);
  const byRole: Record<string, number> = {};
  let processed = input.errors.length;
  let imported = 0;
  let skipped = input.errors.length;

  // Progress writes are chained so they land in order; one that fails is not fatal, the final
  // write carries the exact counters.
  let writes: Promise<unknown> = Promise.resolve();
  const persistProgress = () => {
    const snapshot = { processed, imported, skipped, errors: [...errors] };
    writes = writes.then(() =>
      db
        .update(schema.importJob)
        .set(snapshot)
        .where(eq(schema.importJob.id, jobId))
        .catch((error: unknown) => console.error("Could not persist import progress", error)),
    );
  };

  try {
    let next = 0;
    const worker = async () => {
      while (next < input.valid.length) {
        const candidate = input.valid[next]!;
        next += 1;
        try {
          await provision(candidate);
          imported += 1;
          byRole[candidate.role] = (byRole[candidate.role] ?? 0) + 1;
        } catch (error) {
          skipped += 1;
          if (errors.length < MAX_IMPORT_ERRORS) {
            errors.push({ row: candidate.row, message: rowFailure(candidate, error) });
          }
        }
        processed += 1;
        if (processed % IMPORT_PROGRESS_EVERY === 0) {
          persistProgress();
        }
      }
    };
    await Promise.all(Array.from({ length: IMPORT_CONCURRENCY }, worker));
    await writes;

    await recordAudit(
      {
        auditLogger: deps.auditLogger,
        org: { id: organizationId },
        session: {
          user: { id: actor.userId },
          session: { impersonatedBy: actor.impersonatorUserId },
        },
      },
      {
        action: "user.imported",
        targetType: "import_job",
        targetId: jobId,
        metadata: { jobId, total: input.total, imported, skipped, byRole },
      },
    );
    await db
      .update(schema.importJob)
      .set({ status: "done", processed, imported, skipped, errors, finishedAt: new Date() })
      .where(eq(schema.importJob.id, jobId));
  } catch (error) {
    console.error("Import job failed", error);
    await writes;
    await db
      .update(schema.importJob)
      .set({
        status: "failed",
        processed,
        imported,
        skipped,
        errors:
          errors.length < MAX_IMPORT_ERRORS
            ? [...errors, { row: 0, message: IMPORT_FAILED_MESSAGE }]
            : errors,
        finishedAt: new Date(),
      })
      .where(eq(schema.importJob.id, jobId))
      .catch((updateError: unknown) => console.error("Could not mark import failed", updateError));
  }
}

/** The job of `organizationId`, or `null` (also for another institution's id). */
export async function getImportJob(db: Database, organizationId: string, jobId: string) {
  const [job] = await db
    .select({
      kind: schema.importJob.kind,
      status: schema.importJob.status,
      total: schema.importJob.total,
      processed: schema.importJob.processed,
      imported: schema.importJob.imported,
      skipped: schema.importJob.skipped,
      errors: schema.importJob.errors,
      startedAt: schema.importJob.startedAt,
      finishedAt: schema.importJob.finishedAt,
      createdBy: schema.importJob.createdBy,
    })
    .from(schema.importJob)
    .where(
      and(eq(schema.importJob.organizationId, organizationId), eq(schema.importJob.id, jobId)),
    );
  return job ?? null;
}

/**
 * Server start (D7, USR-R12): a job still `running` belongs to a process that no longer exists.
 * Marks it failed so the institution can import again; re-uploading is safe because existing
 * documents are skipped. Single-instance assumption: with several server processes, a starting
 * instance would also fail another instance's live job.
 *
 * `cutoff` bounds the sweep to jobs started before it: a job created later is alive and must
 * keep holding the one-running-job slot. `import_job.started_at` is written by the database
 * (`default now()`), so by default the cutoff is the database's own `now()`: both sides share one
 * clock and app/DB skew cannot misclassify a job. The boot sweep runs before the server accepts
 * requests, so every job started before that instant belongs to a previous process. Pass a
 * `Date` only to pin the cutoff explicitly (tests).
 */
export async function sweepInterruptedImports(db: Database, cutoff?: Date): Promise<number> {
  const interrupted = JSON.stringify([{ row: 0, message: IMPORT_INTERRUPTED_MESSAGE }]);
  const swept = await db
    .update(schema.importJob)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errors: sql`case when jsonb_array_length(${schema.importJob.errors}) < ${MAX_IMPORT_ERRORS}
        then ${schema.importJob.errors} || ${interrupted}::jsonb else ${schema.importJob.errors} end`,
    })
    .where(
      and(
        eq(schema.importJob.status, "running"),
        lt(schema.importJob.startedAt, cutoff ?? sql`now()`),
      ),
    )
    .returning({ id: schema.importJob.id });
  return swept.length;
}

/** Finished import jobs are kept this long for the progress screen and support, then purged. */
export const IMPORT_JOB_RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes `done` and `failed` jobs that finished more than `IMPORT_JOB_RETENTION_DAYS` before
 * `now` (sige/03 retention) and returns how many went. `running` jobs are never touched.
 */
export async function purgeFinishedImportJobs(
  db: Database,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - IMPORT_JOB_RETENTION_DAYS * MS_PER_DAY);
  const result = await db
    .delete(schema.importJob)
    .where(
      and(
        inArray(schema.importJob.status, ["done", "failed"]),
        lt(schema.importJob.finishedAt, cutoff),
      ),
    );
  return result.rowCount ?? 0;
}
