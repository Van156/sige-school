import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import { organization, user } from "./auth";
import {
  IMPORT_JOB_CREATOR_FK,
  IMPORT_JOB_RUNNING_UNIQUE,
  importJob,
  importKind,
  importStatus,
} from "./import-job";
import { person } from "./person";

/** Constraint-level behavior of sige/03 §2.1 against a real Postgres. */
const url = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(url, "import_job schema");

type PgFailure = { code?: string; constraint?: string };

/** Runs `work` and returns the Postgres error (unwrapping Drizzle's `cause`), or `null`. */
async function pgFailure(work: () => Promise<unknown>): Promise<PgFailure | null> {
  try {
    await work();
    return null;
  } catch (error) {
    const wrapped = error as PgFailure & { cause?: PgFailure };
    return wrapped.code ? wrapped : (wrapped.cause ?? wrapped);
  }
}

describe("import_job enums", () => {
  test("match sige/03 §2.1", () => {
    expect(importKind.enumValues).toEqual(["users", "students"]);
    expect(importStatus.enumValues).toEqual(["running", "done", "failed"]);
  });
});

describe.skipIf(!reachable)("import_job constraints (sige/03 §2.1, D7)", () => {
  let handle: TestDatabaseHandle;
  const marker = crypto.randomUUID().slice(0, 8);
  const orgA = `org-a-${marker}`;
  const orgB = `org-b-${marker}`;
  let personA = "";
  let personB = "";

  const cleanup = async () => {
    for (const id of [orgA, orgB]) {
      await handle.db.execute(sql`delete from "organization" where id = ${id}`);
    }
    await handle.db.execute(sql`delete from "user" where id like ${`u-${marker}%`}`);
  };

  beforeAll(async () => {
    handle = createTestDatabase(url);
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await handle.close();
  });
  beforeEach(async () => {
    await cleanup();
    await handle.db.insert(organization).values([
      { id: orgA, name: "Colegio A", slug: `a-${marker}` },
      { id: orgB, name: "Colegio B", slug: `b-${marker}` },
    ]);
    const people = [];
    for (const [index, organizationId] of [orgA, orgB].entries()) {
      const userId = `u-${marker}-${index}`;
      await handle.db.insert(user).values({ id: userId, name: "T", email: `${userId}@x.test` });
      const [row] = await handle.db
        .insert(person)
        .values({ organizationId, userId, firstName: "T", lastName: "T", documentNumber: "12345" })
        .returning();
      people.push(row!.id);
    }
    [personA, personB] = people as [string, string];
  });

  const db = () => handle.db;
  const jobValues = (extra: Partial<typeof importJob.$inferInsert> = {}) => ({
    organizationId: orgA,
    kind: "users" as const,
    createdBy: personA,
    ...extra,
  });

  test("defaults: running, zero counters, empty errors, timestamps", async () => {
    const [row] = await db().insert(importJob).values(jobValues()).returning();
    expect(row).toMatchObject({
      status: "running",
      total: 0,
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      finishedAt: null,
    });
    expect(row?.id).toHaveLength(36);
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.startedAt).toBeInstanceOf(Date);
  });

  test("errors round-trip as { row, message } entries", async () => {
    const errors = [{ row: 3, message: "Fila 3: Falta el documento." }];
    const [row] = await db().insert(importJob).values(jobValues({ errors })).returning();
    expect(row?.errors).toEqual(errors);
  });

  test("a second running job of the same kind in one institution is rejected", async () => {
    await db().insert(importJob).values(jobValues());
    const failure = await pgFailure(() => db().insert(importJob).values(jobValues()));
    expect(failure).toMatchObject({ code: "23505", constraint: IMPORT_JOB_RUNNING_UNIQUE });
  });

  test("another kind, another institution, or a finished job do not collide", async () => {
    await db().insert(importJob).values(jobValues());
    await db()
      .insert(importJob)
      .values(jobValues({ kind: "students" }));
    await db()
      .insert(importJob)
      .values(jobValues({ organizationId: orgB, createdBy: personB }));
    await db()
      .insert(importJob)
      .values(jobValues({ status: "done" }));
    await db()
      .insert(importJob)
      .values(jobValues({ status: "failed" }));
    await db()
      .insert(importJob)
      .values(jobValues({ status: "done" }));
    const rows = await db().select().from(importJob).where(eq(importJob.organizationId, orgA));
    expect(rows).toHaveLength(5);
  });

  test("finishing a running job frees the slot for the next one", async () => {
    const [first] = await db().insert(importJob).values(jobValues()).returning();
    await db()
      .update(importJob)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(importJob.id, first!.id));
    await db().insert(importJob).values(jobValues());
  });

  test("the restart sweep (running -> failed) frees the slot", async () => {
    await db().insert(importJob).values(jobValues());
    await db().update(importJob).set({ status: "failed" }).where(eq(importJob.status, "running"));
    await db().insert(importJob).values(jobValues());
  });

  test("the creator must be a person of the same institution", async () => {
    const failure = await pgFailure(() =>
      db()
        .insert(importJob)
        .values(jobValues({ createdBy: personB })),
    );
    expect(failure).toMatchObject({ code: "23503", constraint: IMPORT_JOB_CREATOR_FK });
  });

  test("a person who created a job cannot be deleted (restrict)", async () => {
    await db().insert(importJob).values(jobValues());
    const failure = await pgFailure(() => db().delete(person).where(eq(person.id, personA)));
    expect(failure).toMatchObject({ code: "23001", constraint: IMPORT_JOB_CREATOR_FK });
  });

  test("deleting the institution cascades its jobs", async () => {
    await db()
      .insert(importJob)
      .values(jobValues({ status: "done" }));
    await db().execute(sql`delete from "organization" where id = ${orgA}`);
    const rows = await db().select().from(importJob).where(eq(importJob.organizationId, orgA));
    expect(rows).toHaveLength(0);
  });

  test("counters cannot be negative", async () => {
    for (const column of ["total", "processed", "imported", "skipped"] as const) {
      const failure = await pgFailure(() =>
        db()
          .insert(importJob)
          .values(jobValues({ [column]: -1, status: "done" })),
      );
      expect(failure?.code).toBe("23514");
    }
  });

  test("errors must be a JSON array", async () => {
    const failure = await pgFailure(() =>
      db()
        .insert(importJob)
        .values(jobValues({ errors: { row: 1 } as never, status: "done" })),
    );
    expect(failure?.code).toBe("23514");
  });

  test("the listing index exists on (organization_id, created_at desc)", async () => {
    const result = await db().execute(
      sql`select indexdef from pg_indexes where tablename = 'import_job' and indexname = 'import_job_organizationId_createdAt_idx'`,
    );
    const def = String((result.rows[0] as { indexdef?: string } | undefined)?.indexdef ?? "");
    expect(def).toContain("organization_id, created_at DESC");
  });
});
