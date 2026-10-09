import { expect, test } from "bun:test";

import { recoverInterruptedImports } from "./import-recovery";

/** Server start sweep of interrupted imports (sige/03 USR-R12, D7). */

const logger = () => {
  const lines: string[] = [];
  return {
    lines,
    log: {
      info: (message: string) => lines.push(`info: ${message}`),
      error: (message: string) => lines.push(`error: ${message}`),
    },
  };
};

test("reports how many running jobs were marked failed", async () => {
  const { lines, log } = logger();
  await recoverInterruptedImports(() => Promise.resolve(2), log);
  expect(lines).toEqual(["info: [server] marked 2 interrupted import job(s) as failed"]);
});

test("stays quiet when nothing was running", async () => {
  const { lines, log } = logger();
  await recoverInterruptedImports(() => Promise.resolve(0), log);
  expect(lines).toEqual([]);
});

test("a failing sweep is logged and never stops the server from starting", async () => {
  const { lines, log } = logger();
  await recoverInterruptedImports(() => Promise.reject(new Error("db down")), log);
  expect(lines).toEqual(["error: [server] could not sweep interrupted imports: db down"]);
});
