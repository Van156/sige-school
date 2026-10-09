/**
 * Background execution of an import (sige/03 USR-R12, D7) behind a small port, so the API
 * never depends on how work is scheduled and tests await completion deterministically.
 *
 * The production adapter runs the task in the server process, after the request that started it
 * returns. A job that was running when the process stopped is marked failed at the next start
 * (`sweepInterruptedImports`); moving to an external queue later only replaces this adapter.
 */
export interface ImportJobRunnerPort {
  /** Starts `task` without waiting for it; the task must never reject (it records its own failure). */
  run(task: () => Promise<void>): void;
}

/** In-process adapter: the task starts on a later turn of the event loop, never inside the request. */
export function createInProcessImportRunner(
  onError: (error: unknown) => void = (error) => console.error("Import job crashed", error),
): ImportJobRunnerPort {
  return {
    run(task) {
      setTimeout(() => {
        task().catch(onError);
      }, 0);
    },
  };
}

export const defaultImportRunner: ImportJobRunnerPort = createInProcessImportRunner();
