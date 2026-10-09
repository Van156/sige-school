import { createBetterAuthAuthorization } from "@base-template/api/authorization";
import { createBetterAuthPlatformAdmin } from "@base-template/api/platform-admin";
import { createAuth } from "@base-template/auth";
import type { AuditRetentionJobHandle } from "@base-template/auth/audit";
import { createDrizzleAuditLogger, startAuditRetentionJob } from "@base-template/auth/audit";
import { createEmailSender } from "@base-template/auth/email";
import { purgeFinishedImportJobs } from "@base-template/api/sige/user-import-service";
import { createLocalFileStorage } from "@base-template/api/storage/local";
import { createDb } from "@base-template/db";

import { ENV } from "./env.server";
import { startImportJobPurge } from "./import-purge";

export const db = createDb(ENV);
export const emailSender = createEmailSender(ENV);
export const auditLogger = createDrizzleAuditLogger(db);
export const auth = createAuth(ENV, db, emailSender, auditLogger);
export const authorization = createBetterAuthAuthorization(auth);
export const platformAdmin = createBetterAuthPlatformAdmin(auth);
/** Dev/test file storage (sige/02 §2.2); `index.ts` serves it under `/files`. */
export const fileStorage = createLocalFileStorage({
  directory: ENV.FILE_STORAGE_DIR ?? "./storage",
  publicBaseUrl: ENV.FILE_STORAGE_PUBLIC_URL ?? `${ENV.BETTER_AUTH_URL.replace(/\/+$/, "")}/files`,
});

/**
 * Starts the background jobs (the R7.6 audit retention job and the import-job purge) and returns a handle to stop them.
 * Deliberately not run at import: scripts and tests import this module, and a live timer must
 * never start as a side effect. Only `index.ts` calls it.
 */
export function startBackgroundJobs(): { stop: () => void } {
  // R7.6: unset AUDIT_LOG_RETENTION_DAYS means "keep forever" — no job starts.
  const retentionJob: AuditRetentionJobHandle | null = startAuditRetentionJob(
    db,
    ENV.AUDIT_LOG_RETENTION_DAYS,
  );
  // Finished import jobs are purged after 30 days (sige/03 retention).
  const importPurge = startImportJobPurge({
    purge: (now) => purgeFinishedImportJobs(db, now),
    log: console,
  });
  return {
    stop: () => {
      retentionJob?.stop();
      importPurge.stop();
    },
  };
}
