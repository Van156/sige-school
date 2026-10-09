import { z } from "zod";

import type { ImportJobStatus } from "../types";
import { isImportTerminal, validateImportFile } from "./user-import";

/**
 * Search params of `/usuarios/importar`: `job` is the running import, kept in the URL so a reload
 * or a lost `importStart` response resumes polling it. A malformed value is dropped.
 */
export const userImportSearchSchema = z.object({
  job: z.string().min(1).optional().catch(undefined),
});

/** Side effects of picking a file, injected so the orchestration stays testable. */
export type SelectFileEffects = {
  /** Forgets the started job (mutation data) and the URL job. */
  resetStart: () => void;
  resetPreview: () => void;
  setFile: (file: File | null) => void;
  setFileError: (message: string | null) => void;
  requestPreview: (file: File) => void;
};

/**
 * A new pick always discards the previous preview and job first (so a stale preview never sits
 * next to another file). A rejected file only shows its message; an accepted one is previewed.
 */
export function selectImportFile(picked: File | null, effects: SelectFileEffects): void {
  effects.resetStart();
  effects.resetPreview();
  const invalid = picked ? validateImportFile(picked) : null;
  effects.setFileError(invalid);
  if (!picked || invalid) {
    effects.setFile(null);
    return;
  }
  effects.setFile(picked);
  effects.requestPreview(picked);
}

/** Side effects of "Importar otro archivo" / a vanished job. */
export type ResetImportEffects = Pick<SelectFileEffects, "resetStart" | "resetPreview"> & {
  setFile: (file: File | null) => void;
  setFileError: (message: string | null) => void;
};

/** Returns to the empty picker. */
export function resetImport(effects: ResetImportEffects): void {
  effects.resetStart();
  effects.resetPreview();
  effects.setFile(null);
  effects.setFileError(null);
}

/** Whether `importJob.get` failed because the job no longer exists (purged or never started). */
export function isJobNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "NOT_FOUND"
  );
}

/**
 * Calls `onFinish` once per job id the first time it is seen finished, however often it is
 * observed again (re-renders, refetches); a different job gets its own call.
 */
export function createFinishNotifier(onFinish: () => void): {
  observe: (jobId: string | null, status: ImportJobStatus | undefined) => void;
} {
  const notified = new Set<string>();
  return {
    observe(jobId, status) {
      if (jobId === null || !isImportTerminal(status) || notified.has(jobId)) {
        return;
      }
      notified.add(jobId);
      onFinish();
    },
  };
}
