import { IMPORT_JOB_RETENTION_DAYS } from "@base-template/api/sige/user-import-service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Scheduler = {
  setInterval: (callback: () => void, intervalMs: number) => { unref?: () => void };
  clearInterval: (handle: { unref?: () => void }) => void;
};

/**
 * Purges finished import jobs older than 30 days (sige/03 retention): once at start, then daily.
 * The purge is injected so this stays free of the database. A failing purge is logged and the
 * schedule keeps running; ticks never overlap within this process.
 */
export function startImportJobPurge(options: {
  purge: (now: Date) => Promise<number>;
  now?: () => Date;
  intervalMs?: number;
  scheduler?: Scheduler;
  log: { info(message: string): void; error(message: string): void };
}): { stop: () => void } {
  const {
    purge,
    now = () => new Date(),
    intervalMs = MS_PER_DAY,
    scheduler = {
      setInterval: (cb, ms) => setInterval(cb, ms),
      clearInterval: (h) => clearInterval(h as never),
    },
    log,
  } = options;
  let purging = false;
  const run = () => {
    if (purging) {
      return;
    }
    purging = true;
    purge(now())
      .then((purged) => {
        if (purged > 0) {
          log.info(
            `[server] purged ${purged} finished import job(s) older than ${IMPORT_JOB_RETENTION_DAYS} days`,
          );
        }
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        log.error(`[server] could not purge import jobs: ${reason}`);
      })
      .finally(() => {
        purging = false;
      });
  };
  run();
  const handle = scheduler.setInterval(run, intervalMs);
  // Never keeps the process alive on its own.
  handle.unref?.();
  return { stop: () => scheduler.clearInterval(handle) };
}
