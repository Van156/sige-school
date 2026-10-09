import type { Database } from "@base-template/db";

/**
 * `gradeRecalculation` port (sige/02 §3.4, OD-8). Module 06 owns the real implementation: it
 * recomputes finals for every unlocked offering x period and never for locked ones. Until it ships
 * the default is a no-op, so criterion mutations already call it from the right place.
 */

/** A transaction handle or the database itself: the recomputation joins the caller's transaction. */
export type RecomputeExecutor = Pick<Database, "select" | "insert" | "update" | "delete">;

export type RecomputeFinalsInput = { scope: "open" };

export type GradeRecalculationPort = {
  /** Resolves with the number of finals that changed. */
  recomputeFinals(
    input: RecomputeFinalsInput,
    executor: RecomputeExecutor,
  ): Promise<{ affectedFinals: number }>;
};

export const noopGradeRecalculation: GradeRecalculationPort = {
  recomputeFinals: async () => ({ affectedFinals: 0 }),
};
