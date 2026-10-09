import { expect, test } from "bun:test";

import { startImportJobPurge } from "./import-purge";

/** Daily purge of finished import jobs (sige/03 retention): scheduling only, no database. */

function harness() {
  let tick: (() => void) | undefined;
  const cleared: unknown[] = [];
  const handle = { unref: () => {} };
  return {
    cleared,
    fire: () => tick?.(),
    scheduler: {
      setInterval: (callback: () => void) => {
        tick = callback;
        return handle;
      },
      clearInterval: (value: unknown) => cleared.push(value),
    },
    handle,
  };
}

test("purges once at start and on every tick, with the current time", async () => {
  const h = harness();
  const nows = [new Date("2026-11-30T00:00:00Z"), new Date("2026-12-01T00:00:00Z")];
  const seen: Date[] = [];
  startImportJobPurge({
    purge: async (now) => {
      seen.push(now);
      return 0;
    },
    now: () => nows[seen.length]!,
    scheduler: h.scheduler,
    log: { info: () => {}, error: () => {} },
  });
  expect(seen).toEqual([nows[0]!]);
  await Bun.sleep(0); // let the first purge settle so the overlap latch is released
  h.fire();
  expect(seen).toEqual(nows);
});

test("logs how many jobs were purged and survives a failing purge", async () => {
  const h = harness();
  const lines: string[] = [];
  let calls = 0;
  startImportJobPurge({
    purge: async () => {
      calls += 1;
      if (calls === 1) return 3;
      throw new Error("db down");
    },
    now: () => new Date(),
    scheduler: h.scheduler,
    log: { info: (m) => lines.push(`info: ${m}`), error: (m) => lines.push(`error: ${m}`) },
  });
  await Bun.sleep(0);
  h.fire();
  await Bun.sleep(0);
  expect(lines).toEqual([
    "info: [server] purged 3 finished import job(s) older than 30 days",
    "error: [server] could not purge import jobs: db down",
  ]);
});

test("does not overlap purges and stop() clears the timer", async () => {
  const h = harness();
  let release!: () => void;
  let calls = 0;
  const job = startImportJobPurge({
    purge: () => {
      calls += 1;
      return new Promise<number>((resolve) => {
        release = () => resolve(0);
      });
    },
    now: () => new Date(),
    scheduler: h.scheduler,
    log: { info: () => {}, error: () => {} },
  });
  h.fire();
  expect(calls).toBe(1);
  release();
  await Bun.sleep(0);
  h.fire();
  expect(calls).toBe(2);
  job.stop();
  expect(h.cleared).toEqual([h.handle]);
});
