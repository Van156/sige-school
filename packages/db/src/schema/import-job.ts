import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { person } from "./person";

/** Bulk-import progress (sige/03 §2.1), shared by the user import and, later, module 05. */

export const importKind = pgEnum("import_kind", ["users", "students"]);
export const importStatus = pgEnum("import_status", ["running", "done", "failed"]);

/**
 * Exact constraint names, matched by the import service to turn a Postgres error into the spec
 * message ("Ya hay una importación en curso.") without a racy pre-check.
 */
export const IMPORT_JOB_RUNNING_UNIQUE = "import_job_organizationId_kind_running_unique";
export const IMPORT_JOB_CREATOR_FK = "import_job_creator_fk";

/** One entry of `import_job.errors` (capped at `MAX_IMPORT_ERRORS`; the exact count is `skipped`). */
export type ImportJobError = { row: number; message: string };

export const importJob = pgTable(
  "import_job",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: importKind("kind").notNull(),
    status: importStatus("status").default("running").notNull(),
    total: integer("total").default(0).notNull(),
    processed: integer("processed").default(0).notNull(),
    imported: integer("imported").default(0).notNull(),
    skipped: integer("skipped").default(0).notNull(),
    errors: jsonb("errors").$type<ImportJobError[]>().default([]).notNull(),
    createdBy: text("created_by").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: IMPORT_JOB_CREATOR_FK,
      columns: [table.organizationId, table.createdBy],
      foreignColumns: [person.organizationId, person.id],
    }).onDelete("restrict"),
    // D7: at most one running job per institution and kind, enforced by the database so two
    // concurrent `importStart` calls cannot both win. Finished and failed jobs are unconstrained.
    uniqueIndex(IMPORT_JOB_RUNNING_UNIQUE)
      .on(table.organizationId, table.kind)
      .where(sql`${table.status} = 'running'`),
    index("import_job_organizationId_createdAt_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    check(
      "import_job_counters_check",
      sql`${table.total} >= 0 and ${table.processed} >= 0 and ${table.imported} >= 0 and ${table.skipped} >= 0`,
    ),
    check("import_job_errors_check", sql`jsonb_typeof(${table.errors}) = 'array'`),
  ],
);
