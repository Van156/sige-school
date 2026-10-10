import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { MAX_IMPORT_ERRORS } from "@base-template/sige-core";
import type { ImportRowError } from "@base-template/sige-core";
import { eq } from "drizzle-orm";

import { rethrowDbError } from "./pg-errors";

/**
 * The `import_job` lifecycle shared by every Excel import (sige/03 USR-R12, D7; sige/05 STU-R8):
 * `createImportJob` records the job (rows rejected by validation already count as processed and
 * skipped), and `executeImportJob` processes the valid rows with concurrency 4, persists progress
 * every 25 rows and finishes the job `done` (after the kind's `finish`, typically its one audit
 * event) or `failed`. A row whose `process` throws is skipped with its message; it never aborts
 * the job. `executeImportJob` never rejects.
 */

export const IMPORT_CONCURRENCY = 4;
export const IMPORT_PROGRESS_EVERY = 25;
// Writer-authored (not in the spec).
export const IMPORT_FAILED_MESSAGE = "No se pudo completar la importación.";

export type ImportJobKind = (typeof schema.importJob.$inferInsert)["kind"];

/** Records a `running` job; the running-job index (D7) refuses a second one as `CONFLICT`. */
export async function createImportJob(
  db: Database,
  job: {
    organizationId: string;
    kind: ImportJobKind;
    createdBy: string;
    total: number;
    errors: readonly ImportRowError[];
  },
): Promise<string> {
  try {
    const [row] = await db
      .insert(schema.importJob)
      .values({
        organizationId: job.organizationId,
        kind: job.kind,
        total: job.total,
        // Rows rejected by validation are already processed (skipped) when the job starts.
        processed: job.errors.length,
        skipped: job.errors.length,
        errors: job.errors.slice(0, MAX_IMPORT_ERRORS),
        createdBy: job.createdBy,
      })
      .returning({ id: schema.importJob.id });
    return row!.id;
  } catch (error) {
    return rethrowDbError(error, "write");
  }
}

export type ImportJobSteps<C> = {
  /** Writes one valid row; throws to skip it. */
  process(candidate: C): Promise<void>;
  /** The Spanish row message ("Fila n: ...") recorded for a row whose `process` threw. */
  failureMessage(candidate: C, error: unknown): string;
  /** Runs once after every row, before the job is marked `done`; a throw fails the job. */
  finish(counts: { imported: number; skipped: number }): Promise<void>;
};

export async function executeImportJob<C extends { row: number }>(
  db: Database,
  jobId: string,
  input: { valid: readonly C[]; errors: readonly ImportRowError[] },
  steps: ImportJobSteps<C>,
): Promise<void> {
  const errors = input.errors.slice(0, MAX_IMPORT_ERRORS);
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
          await steps.process(candidate);
          imported += 1;
        } catch (error) {
          skipped += 1;
          if (errors.length < MAX_IMPORT_ERRORS) {
            errors.push({ row: candidate.row, message: steps.failureMessage(candidate, error) });
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

    await steps.finish({ imported, skipped });
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
