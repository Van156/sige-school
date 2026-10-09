import { RecordingAuditLogger } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import type { ImportCandidate } from "@base-template/sige-core";
import { MAX_IMPORT_ERRORS } from "@base-template/sige-core";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import { sigeSuite } from "./testing";
import { createTrackedImportRunner } from "./testing";
import type { TestTenant } from "./testing";
import {
  getImportJob,
  IMPORT_JOB_RETENTION_DAYS,
  purgeFinishedImportJobs,
  runUserImport,
  startUserImport,
  sweepInterruptedImports,
  IMPORT_INTERRUPTED_MESSAGE,
} from "./user-import-service";

/** Background import (sige/03 USR-R12, D7): concurrency, progress, conflict, failure, sweep. */

const candidate = (row: number, role: ImportCandidate["role"] = "teacher"): ImportCandidate => ({
  row,
  firstName: "Ana",
  lastName: `Gil${row}`,
  documentType: "CC",
  documentNumber: `77${String(row).padStart(7, "0")}`,
  role,
});

const failure = async (work: Promise<unknown>) =>
  work.then(
    () => null,
    (error: unknown) => error as { code?: string; status?: number; message: string },
  );

await sigeSuite("user import service", (fx) => {
  let tenant: TestTenant;
  let other: TestTenant;
  let audit: RecordingAuditLogger;
  const actor = () => ({
    userId: tenant.people.owner!.userId,
    personId: tenant.people.owner!.personId,
    impersonatorUserId: null,
  });
  const deps = (runner = createTrackedImportRunner()) => {
    audit = new RecordingAuditLogger();
    return { db: fx.db, auditLogger: audit, runner };
  };
  const jobRow = async (id: string) =>
    (await fx.db.select().from(schema.importJob).where(eq(schema.importJob.id, id)))[0]!;
  const clearJobs = () => fx.db.delete(schema.importJob);

  test("provisions tenants", async () => {
    tenant = await fx.provisionTenant("Importa", ["owner"]);
    other = await fx.provisionTenant("OtraImporta", ["owner"]);
  });

  test("start creates a running job, returns its id and the runner finishes it", async () => {
    const d = deps();
    const { jobId } = await startUserImport(d, tenant.orgId, actor(), {
      total: 3,
      valid: [candidate(2), candidate(3, "student")],
      errors: [{ row: 4, message: "Fila 4: Falta el documento." }],
      provision: async () => {},
    });
    expect(await d.runner.pending()).toBe(1);
    const started = await jobRow(jobId);
    expect(started).toMatchObject({
      organizationId: tenant.orgId,
      kind: "users",
      status: "running",
      total: 3,
      createdBy: tenant.people.owner!.personId,
    });
    await d.runner.settled();
    const done = await jobRow(jobId);
    expect(done).toMatchObject({ status: "done", total: 3, processed: 3, imported: 2, skipped: 1 });
    expect(done.finishedAt).not.toBeNull();
    expect(done.errors).toEqual([{ row: 4, message: "Fila 4: Falta el documento." }]);
  });

  test("a second job while one is running is a CONFLICT; another institution and a later job are fine", async () => {
    await clearJobs();
    const d = deps();
    const input = { total: 1, valid: [candidate(2)], errors: [], provision: async () => {} };
    await startUserImport(d, tenant.orgId, actor(), input);
    const conflict = await failure(startUserImport(d, tenant.orgId, actor(), input));
    expect(conflict).toMatchObject({
      code: "CONFLICT",
      message: "Ya hay una importación en curso.",
    });

    await startUserImport(
      d,
      other.orgId,
      {
        userId: other.people.owner!.userId,
        personId: other.people.owner!.personId,
        impersonatorUserId: null,
      },
      input,
    );
    await d.runner.settled();
    await startUserImport(d, tenant.orgId, actor(), input);
    await d.runner.settled();
  });

  test("provisions with concurrency 4", async () => {
    await clearJobs();
    const d = deps();
    let inFlight = 0;
    let peak = 0;
    const provision = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    };
    await startUserImport(d, tenant.orgId, actor(), {
      total: 30,
      valid: Array.from({ length: 30 }, (_, i) => candidate(i + 2)),
      errors: [],
      provision,
    });
    await d.runner.settled();
    expect(peak).toBe(4);
  });

  test("progress is persisted every 25 rows while the job runs", async () => {
    await clearJobs();
    const d = deps();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const provision = async () => {
      calls += 1;
      if (calls > 28) {
        await gate;
      }
    };
    const { jobId } = await startUserImport(d, tenant.orgId, actor(), {
      total: 60,
      valid: Array.from({ length: 60 }, (_, i) => candidate(i + 2)),
      errors: [],
      provision,
    });
    // Rows 1-28 finish, rows 29-32 wait on the gate: the persisted counter is the last multiple of 25.
    for (let attempt = 0; attempt < 200 && (await jobRow(jobId)).processed < 25; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const midway = await jobRow(jobId);
    expect(midway).toMatchObject({ status: "running", processed: 25, imported: 25 });
    release();
    await d.runner.settled();
    expect(await jobRow(jobId)).toMatchObject({ status: "done", processed: 60, imported: 60 });
  });

  test("a failing row is skipped and reported; the others import", async () => {
    await clearJobs();
    const d = deps();
    const { jobId } = await startUserImport(d, tenant.orgId, actor(), {
      total: 3,
      valid: [candidate(2), candidate(3), candidate(4)],
      errors: [],
      provision: async (row) => {
        if (row.row === 3) {
          throw new ORPCError("CONFLICT", {
            status: 409,
            message: "Ya existe un usuario con este documento.",
          });
        }
        if (row.row === 4) {
          throw new Error("database exploded: secret=hunter2");
        }
      },
    });
    await d.runner.settled();
    const job = await jobRow(jobId);
    expect(job).toMatchObject({ status: "done", processed: 3, imported: 1, skipped: 2 });
    expect(job.errors).toEqual([
      { row: 3, message: `Fila 3: El documento "${candidate(3).documentNumber}" ya existe.` },
      { row: 4, message: "Fila 4: No se pudo crear el usuario." },
    ]);
    expect(JSON.stringify(job.errors)).not.toContain("hunter2");
  });

  test("errors are capped at 200 while skipped stays exact", async () => {
    await clearJobs();
    const d = deps();
    const errors = Array.from({ length: 150 }, (_, i) => ({
      row: i + 2,
      message: `Fila ${i + 2}: x`,
    }));
    const { jobId } = await startUserImport(d, tenant.orgId, actor(), {
      total: 400,
      valid: Array.from({ length: 250 }, (_, i) => candidate(i + 1000)),
      errors,
      provision: async () => {
        throw new Error("nope");
      },
    });
    await d.runner.settled();
    const job = await jobRow(jobId);
    expect(job.skipped).toBe(400);
    expect(job.processed).toBe(400);
    expect(job.errors).toHaveLength(MAX_IMPORT_ERRORS);
  });

  test("records one user.imported event with the totals and byRole, and no per-user events", async () => {
    await clearJobs();
    const d = deps();
    const { jobId } = await startUserImport(d, tenant.orgId, actor(), {
      total: 4,
      valid: [candidate(2), candidate(3), candidate(4, "student"), candidate(5, "student")],
      errors: [],
      provision: async (row) => {
        if (row.row === 5) {
          throw new Error("x");
        }
      },
    });
    await d.runner.settled();
    expect(audit.events.map((event) => event.action)).toEqual(["user.imported"]);
    expect(audit.events[0]).toMatchObject({
      organizationId: tenant.orgId,
      actorUserId: tenant.people.owner!.userId,
      targetType: "import_job",
      targetId: jobId,
      metadata: { jobId, total: 4, imported: 3, skipped: 1, byRole: { teacher: 2, student: 1 } },
    });
  });

  test("an unexpected failure outside the rows marks the job failed", async () => {
    await clearJobs();
    const d = deps();
    d.auditLogger.record = () => Promise.reject(new Error("audit store down"));
    const { jobId } = await startUserImport(d, tenant.orgId, actor(), {
      total: 1,
      valid: [candidate(2)],
      errors: [],
      provision: async () => {},
    });
    await d.runner.settled();
    const job = await jobRow(jobId);
    expect(job.status).toBe("failed");
    expect(job.finishedAt).not.toBeNull();
    expect(job.errors.at(-1)).toEqual({ row: 0, message: "No se pudo completar la importación." });
  });

  test("runUserImport can be driven directly against an existing job row", async () => {
    await clearJobs();
    const d = deps();
    const [job] = await fx.db
      .insert(schema.importJob)
      .values({
        organizationId: tenant.orgId,
        kind: "users",
        total: 1,
        createdBy: tenant.people.owner!.personId,
      })
      .returning();
    await runUserImport(d, tenant.orgId, actor(), job!.id, {
      total: 1,
      valid: [candidate(2)],
      errors: [],
      provision: async () => {},
    });
    expect((await jobRow(job!.id)).status).toBe("done");
  });

  test("getImportJob is tenant scoped", async () => {
    await clearJobs();
    const d = deps();
    const { jobId } = await startUserImport(d, tenant.orgId, actor(), {
      total: 1,
      valid: [candidate(2)],
      errors: [],
      provision: async () => {},
    });
    await d.runner.settled();
    expect(await getImportJob(fx.db, tenant.orgId, jobId)).toMatchObject({
      kind: "users",
      status: "done",
    });
    expect(await getImportJob(fx.db, other.orgId, jobId)).toBeNull();
    expect(await getImportJob(fx.db, tenant.orgId, "missing")).toBeNull();
  });

  test("the purge removes finished and failed jobs older than 30 days and nothing else", async () => {
    await clearJobs();
    const now = new Date("2026-11-30T12:00:00Z");
    const daysAgo = (days: number, extraMs = 0) =>
      new Date(now.getTime() - days * 86_400_000 + extraMs);
    expect(IMPORT_JOB_RETENTION_DAYS).toBe(30);
    const make = async (
      status: "running" | "done" | "failed",
      orgId: string,
      personId: string,
      finishedAt: Date | null,
      createdAt: Date,
    ) => {
      const [row] = await fx.db
        .insert(schema.importJob)
        .values({
          organizationId: orgId,
          kind: "users",
          status,
          createdBy: personId,
          startedAt: createdAt,
          createdAt,
          finishedAt,
        })
        .returning();
      return row!.id;
    };
    const owner = tenant.people.owner!.personId;
    const otherOwner = other.people.owner!.personId;
    const oldDone = await make("done", tenant.orgId, owner, daysAgo(31), daysAgo(31));
    const oldFailed = await make("failed", tenant.orgId, owner, daysAgo(45), daysAgo(45));
    const recentDone = await make("done", tenant.orgId, owner, daysAgo(29), daysAgo(29));
    // Exactly at the boundary is kept: only strictly older rows are purged.
    const boundary = await make("done", tenant.orgId, owner, daysAgo(30), daysAgo(30));
    const oldRunning = await make("running", other.orgId, otherOwner, null, daysAgo(60));

    expect(await purgeFinishedImportJobs(fx.db, now)).toBe(2);
    const left = (await fx.db.select({ id: schema.importJob.id }).from(schema.importJob)).map(
      (row) => row.id,
    );
    expect(left.toSorted()).toEqual([recentDone, boundary, oldRunning].toSorted());
    expect(left).not.toContain(oldDone);
    expect(left).not.toContain(oldFailed);
    expect(await purgeFinishedImportJobs(fx.db, now)).toBe(0);
  });

  test("the restart sweep spares a job started after the process did", async () => {
    await clearJobs();
    const processStart = new Date("2026-10-01T10:00:00Z");
    const base = {
      organizationId: tenant.orgId,
      kind: "users" as const,
      status: "running" as const,
      total: 10,
      createdBy: tenant.people.owner!.personId,
    };
    const [old] = await fx.db
      .insert(schema.importJob)
      .values({ ...base, startedAt: new Date("2026-10-01T09:59:59Z") })
      .returning();
    // D7 allows one running job per institution, so the survivor belongs to the other tenant.
    const [fresh] = await fx.db
      .insert(schema.importJob)
      .values({
        ...base,
        organizationId: other.orgId,
        createdBy: other.people.owner!.personId,
        startedAt: new Date("2026-10-01T10:00:01Z"),
      })
      .returning();

    expect(await sweepInterruptedImports(fx.db, processStart)).toBe(1);
    expect((await jobRow(old!.id)).status).toBe("failed");
    expect((await jobRow(fresh!.id)).status).toBe("running");
  });

  test("without a cutoff the sweep compares against the database clock", async () => {
    await clearJobs();
    const base = {
      organizationId: tenant.orgId,
      kind: "users" as const,
      status: "running" as const,
      total: 10,
      createdBy: tenant.people.owner!.personId,
    };
    // started_at comes from the database default (now()), so the cutoff must too.
    const [old] = await fx.db.insert(schema.importJob).values(base).returning();
    const [future] = await fx.db
      .insert(schema.importJob)
      .values({
        ...base,
        organizationId: other.orgId,
        createdBy: other.people.owner!.personId,
        startedAt: new Date(Date.now() + 3_600_000),
      })
      .returning();

    expect(await sweepInterruptedImports(fx.db)).toBe(1);
    expect((await jobRow(old!.id)).status).toBe("failed");
    expect((await jobRow(future!.id)).status).toBe("running");
  });

  test("the restart sweep marks running jobs failed and leaves finished ones alone", async () => {
    await clearJobs();
    const values = (status: "running" | "done", orgId: string, personId: string) => ({
      organizationId: orgId,
      kind: "users" as const,
      status,
      total: 10,
      processed: 4,
      createdBy: personId,
    });
    const [a] = await fx.db
      .insert(schema.importJob)
      .values(values("running", tenant.orgId, tenant.people.owner!.personId))
      .returning();
    const [b] = await fx.db
      .insert(schema.importJob)
      .values(values("running", other.orgId, other.people.owner!.personId))
      .returning();
    const [c] = await fx.db
      .insert(schema.importJob)
      .values({
        ...values("done", tenant.orgId, tenant.people.owner!.personId),
        finishedAt: new Date(),
      })
      .returning();

    expect(await sweepInterruptedImports(fx.db, new Date(Date.now() + 60_000))).toBe(2);
    for (const id of [a!.id, b!.id]) {
      const job = await jobRow(id);
      expect(job.status).toBe("failed");
      expect(job.finishedAt).not.toBeNull();
      expect(job.processed).toBe(4);
      expect(job.errors).toEqual([{ row: 0, message: IMPORT_INTERRUPTED_MESSAGE }]);
    }
    expect((await jobRow(c!.id)).status).toBe("done");
    expect(IMPORT_INTERRUPTED_MESSAGE).toBe("Importación interrumpida");
    expect(await sweepInterruptedImports(fx.db, new Date(Date.now() + 60_000))).toBe(0);
    // A new job can start once the stale one no longer holds the running slot.
    const d = deps();
    await startUserImport(d, tenant.orgId, actor(), {
      total: 1,
      valid: [candidate(2)],
      errors: [],
      provision: async () => {},
    });
    await d.runner.settled();
  });
});
