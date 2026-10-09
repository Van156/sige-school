/**
 * Start-up sweep of interrupted imports (sige/03 USR-R12, D7): the background job runs inside
 * the server process, so a job still `running` at boot died with the previous process. The sweep
 * is injected so this stays free of the database and trivially testable; a failure is logged and
 * never prevents the server from starting.
 */
export async function recoverInterruptedImports(
  sweep: () => Promise<number>,
  log: { info(message: string): void; error(message: string): void },
): Promise<void> {
  try {
    const swept = await sweep();
    if (swept > 0) {
      log.info(`[server] marked ${swept} interrupted import job(s) as failed`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.error(`[server] could not sweep interrupted imports: ${reason}`);
  }
}
