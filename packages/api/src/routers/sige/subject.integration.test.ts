import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  isolationCase,
  racingDb,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import { subjectRouter } from "./subject";

/** `subject.*` (sige/02 INS-13/14, §3.3, §4): CRUD, unique code, audit, matrix, isolation. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const seedSubject = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.subject.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.subject)
    .values({ organizationId: tenant.orgId, name: `Materia ${crypto.randomUUID()}`, ...values })
    .returning();
  return row!;
};

await sigeSuite("subject router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let teacher: Context;
  let audit: RecordingAuditLogger;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Asignaturas", ["owner", "teacher"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    teacher = await fx.contextFor(tenant.people.teacher!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
  });

  test("create trims, treats a blank code as absent and audits once", async () => {
    audit.reset();
    const created = await call(
      subjectRouter.create,
      { name: "  Matemáticas ", code: "  " },
      { context: owner },
    );
    expect(created).toEqual({ id: expect.any(String), name: "Matemáticas", code: null });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "subject.created",
      targetType: "subject",
      targetId: created.id,
      organizationId: tenant.orgId,
    });
  });

  test("a duplicate code is a CONFLICT; two subjects without code coexist", async () => {
    await seedSubject(fx, tenant, { code: "MAT" });
    const error = await errorOf(
      call(subjectRouter.create, { name: "Otra", code: "MAT" }, { context: owner }),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Ya existe una asignatura con este código.");
    await call(subjectRouter.create, { name: "Sin código 1" }, { context: owner });
    await call(subjectRouter.create, { name: "Sin código 2" }, { context: owner });
  });

  test("the same code is allowed in another institution", async () => {
    const other = await fx.provisionTenant("Otra", ["owner"]);
    await seedSubject(fx, other, { code: "MAT" });
    const ctx = await fx.contextFor(other.people.owner!, other);
    const rows = await call(subjectRouter.list, undefined, { context: ctx });
    expect(rows.map((r) => r.code)).toEqual(["MAT"]);
  });

  test("blank name is rejected with the spec message", async () => {
    const error = await errorOf(call(subjectRouter.create, { name: " " }, { context: owner }));
    expect(JSON.stringify(error?.data ?? error)).toContain(
      "El nombre de la asignatura es obligatorio.",
    );
  });

  test("get returns the row; list orders by name", async () => {
    const t = await fx.provisionTenant("Orden", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const b = await seedSubject(fx, t, { name: "B" });
    await seedSubject(fx, t, { name: "A" });
    expect(
      (await call(subjectRouter.list, undefined, { context: ctx })).map((r) => r.name),
    ).toEqual(["A", "B"]);
    expect(await call(subjectRouter.get, { id: b.id }, { context: ctx })).toEqual({
      id: b.id,
      name: "B",
      code: null,
    });
  });

  test("update is a full replace (omitted code clears) and audits changed fields only", async () => {
    const subject = await seedSubject(fx, tenant, { name: "Vieja", code: "VIE" });
    audit.reset();
    const updated = await call(
      subjectRouter.update,
      { id: subject.id, name: "Nueva" },
      { context: owner },
    );
    expect(updated).toEqual({ id: subject.id, name: "Nueva", code: null });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("subject.updated");
    expect(audit.events[0]?.metadata).toMatchObject({
      changes: {
        name: { from: "Vieja", to: "Nueva" },
        code: { from: "VIE", to: null },
      },
    });
  });

  test("update to a taken code is a CONFLICT and audits nothing", async () => {
    await seedSubject(fx, tenant, { code: "TAKEN" });
    const subject = await seedSubject(fx, tenant);
    audit.reset();
    const error = await errorOf(
      call(subjectRouter.update, { id: subject.id, name: "x", code: "TAKEN" }, { context: owner }),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(audit.events).toHaveLength(0);
  });

  test("get/update/delete of a missing id is NOT_FOUND", async () => {
    for (const run of [
      () => call(subjectRouter.get, { id: "nope" }, { context: owner }),
      () => call(subjectRouter.update, { id: "nope", name: "x" }, { context: owner }),
      () => call(subjectRouter.delete, { id: "nope" }, { context: owner }),
    ]) {
      expect((await errorOf(run()))?.code).toBe("NOT_FOUND");
    }
  });

  test("delete removes the row and snapshots the name", async () => {
    const subject = await seedSubject(fx, tenant, { code: "DEL" });
    audit.reset();
    expect(await call(subjectRouter.delete, { id: subject.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "subject.deleted",
      metadata: { snapshot: { name: subject.name, code: "DEL" } },
    });
    const rows = await fx.db.select().from(schema.subject).where(eq(schema.subject.id, subject.id));
    expect(rows).toHaveLength(0);
  });

  test("update/delete lose a race to a concurrent delete: NOT_FOUND and no audit", async () => {
    for (const op of ["update", "delete"] as const) {
      const subject = await seedSubject(fx, tenant);
      const racing = {
        ...owner,
        db: racingDb(fx.db, async () => {
          await fx.db.delete(schema.subject).where(eq(schema.subject.id, subject.id));
        }),
      } as Context;
      audit.reset();
      const run =
        op === "update"
          ? call(subjectRouter.update, { id: subject.id, name: "x" }, { context: racing })
          : call(subjectRouter.delete, { id: subject.id }, { context: racing });
      expect((await errorOf(run))?.code).toBe("NOT_FOUND");
      expect(audit.events).toHaveLength(0);
    }
  });

  test("the teacher lists and gets but cannot mutate", async () => {
    const subject = await seedSubject(fx, tenant);
    expect(await call(subjectRouter.list, undefined, { context: teacher })).toBeArray();
    expect((await call(subjectRouter.get, { id: subject.id }, { context: teacher })).id).toBe(
      subject.id,
    );
    const error = await errorOf(call(subjectRouter.create, { name: "x" }, { context: teacher }));
    expect(error?.code).toBe("FORBIDDEN");
  });
});

await testPermissionMatrix({
  name: "subject",
  procedures: [
    {
      name: "subject.list",
      permissions: { subject: ["read"] },
      run: (context) => call(subjectRouter.list, undefined, { context }),
    },
    {
      name: "subject.get",
      permissions: { subject: ["read"] },
      run: (context) => call(subjectRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "subject.create",
      permissions: { subject: ["create"] },
      run: (context) => call(subjectRouter.create, { name: "x" }, { context }),
    },
    {
      name: "subject.update",
      permissions: { subject: ["update"] },
      run: (context) => call(subjectRouter.update, { id: "missing", name: "x" }, { context }),
    },
    {
      name: "subject.delete",
      permissions: { subject: ["delete"] },
      run: (context) => call(subjectRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { subjectId: string; subjectName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const subject = await seedSubject(fx, tenant);
  return { subjectId: subject.id, subjectName: subject.name };
};
const untouched = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.subject)
    .where(eq(schema.subject.id, foreign.subjectId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.subjectName);
};

await testTenantIsolation({
  name: "subject",
  cases: [
    isolationCase({
      name: "subject.list never returns the other tenant's subjects",
      seed,
      run: ({ context }) => call(subjectRouter.list, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.subjectId, foreign.subjectName],
    }),
    isolationCase({
      name: "subject.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(subjectRouter.get, { id: foreign.subjectId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "subject.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(subjectRouter.update, { id: foreign.subjectId, name: "Hackeada" }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
    isolationCase({
      name: "subject.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(subjectRouter.delete, { id: foreign.subjectId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
  ],
});
