import type { ImportJobRunnerPort } from "../import-runner";

/**
 * Test double of `ImportJobRunnerPort`: starts tasks like the real adapter but remembers them, so
 * a test awaits `settled()` instead of polling. A task that rejects fails `settled()`.
 */
export function createTrackedImportRunner(): ImportJobRunnerPort & {
  /** Resolves when every started task (including ones started meanwhile) has finished. */
  settled(): Promise<void>;
  /** Tasks started and not yet finished. */
  pending(): Promise<number>;
} {
  const running = new Set<Promise<void>>();
  return {
    run(task) {
      const promise = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          task().then(resolve, reject);
        }, 0);
      });
      running.add(promise);
      const forget = () => running.delete(promise);
      promise.then(forget, forget);
    },
    async settled() {
      while (running.size > 0) {
        await Promise.all(running);
      }
    },
    pending() {
      return Promise.resolve(running.size);
    },
  };
}
