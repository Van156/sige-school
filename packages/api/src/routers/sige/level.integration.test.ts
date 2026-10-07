import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  isolationCase,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import { levelRouter } from "./level";

/** `level.*` (sige/02 INS-09/10, §3.3, §4): CRUD, immutable campus (INS-R6), delete blocks, audit. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const seedCampus = async (fx: SigeTestFixture, tenant: TestTenant, name?: string) => {
  const [row] = await fx.db
    .insert(schema.campus)
    .values({ organizationId: tenant.orgId, name: name ?? `Sede ${crypto.randomUUID()}` })
    .returning();
  return row!;
};

const seedLevel = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: Partial<typeof schema.gradeLevel.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.gradeLevel)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Nivel ${crypto.randomUUID()}`,
      ...values,
    })
    .returning();
  return row!;
};

await sigeSuite("level router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let audit: RecordingAuditLogger;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Niveles", ["owner", "coordinator"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
  });

  test("create returns the row with campus name; one audit event", async () => {
    const campus = await seedCampus(fx, tenant, "Norte");
    audit.reset();
    const created = await call(
      levelRouter.create,
      { campusId: campus.id, name: " Primaria ", orderNum: 2 },
      { context: owner },
    );
    expect(created).toMatchObject({
      campusId: campus.id,
      campusName: "Norte",
      name: "Primaria",
      orderNum: 2,
      courseCount: 0,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "level.created",
      targetType: "level",
      targetId: created.id,
      organizationId: tenant.orgId,
    });
  });

  test("create on a missing or foreign campus is NOT_FOUND", async () => {
    const error = await errorOf(
      call(levelRouter.create, { campusId: "nope", name: "X", orderNum: 0 }, { context: owner }),
    );
    expect(error?.code).toBe("NOT_FOUND");
  });

  test("duplicate name in a campus is a CONFLICT; the same name in another campus is fine", async () => {
    const a = await seedCampus(fx, tenant);
    const b = await seedCampus(fx, tenant);
    await seedLevel(fx, tenant, a.id, { name: "Bachillerato" });
    const error = await errorOf(
      call(
        levelRouter.create,
        { campusId: a.id, name: "Bachillerato", orderNum: 0 },
        { context: owner },
      ),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Ya existe un nivel con este nombre en la sede.");
    const ok = await call(
      levelRouter.create,
      { campusId: b.id, name: "Bachillerato", orderNum: 0 },
      { context: owner },
    );
    expect(ok.campusId).toBe(b.id);
  });

  test("update changes name/order, keeps the campus, audits changed fields only", async () => {
    const campus = await seedCampus(fx, tenant);
    const level = await seedLevel(fx, tenant, campus.id, { name: "Viejo", orderNum: 1 });
    audit.reset();
    const updated = await call(
      levelRouter.update,
      { id: level.id, name: "Nuevo", orderNum: 1 },
      { context: owner },
    );
    expect(updated).toMatchObject({ name: "Nuevo", orderNum: 1, campusId: campus.id });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("level.updated");
    const metadata = audit.events[0]?.metadata as { changes: unknown };
    expect(metadata.changes).toEqual({ name: { from: "Viejo", to: "Nuevo" } });
  });

  test("the update input has no campusId: the campus is immutable (INS-R6)", async () => {
    const campus = await seedCampus(fx, tenant);
    const other = await seedCampus(fx, tenant);
    const level = await seedLevel(fx, tenant, campus.id);
    const updated = await call(
      levelRouter.update,
      { id: level.id, name: "Mismo", orderNum: 0, campusId: other.id } as never,
      { context: owner },
    );
    expect(updated.campusId).toBe(campus.id);
  });

  test("update/delete of a missing id is NOT_FOUND", async () => {
    expect(
      (
        await errorOf(
          call(levelRouter.update, { id: "nope", name: "x", orderNum: 0 }, { context: owner }),
        )
      )?.code,
    ).toBe("NOT_FOUND");
    expect(
      (await errorOf(call(levelRouter.delete, { id: "nope" }, { context: owner })))?.code,
    ).toBe("NOT_FOUND");
  });

  test("delete removes an empty level and snapshots its name", async () => {
    const campus = await seedCampus(fx, tenant);
    const level = await seedLevel(fx, tenant, campus.id);
    audit.reset();
    expect(await call(levelRouter.delete, { id: level.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "level.deleted",
      metadata: { snapshot: { name: level.name } },
    });
  });

  test("a level with courses is HAS_DEPENDENTS and stays intact", async () => {
    const campus = await seedCampus(fx, tenant);
    const level = await seedLevel(fx, tenant, campus.id);
    await fx.db.insert(schema.course).values({
      organizationId: tenant.orgId,
      campusId: campus.id,
      levelId: level.id,
      name: "6A",
      academicYear: "2026",
      shift: "Mañana",
    });
    audit.reset();
    const error = await errorOf(call(levelRouter.delete, { id: level.id }, { context: owner }));
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.status).toBe(409);
    expect(error?.message).toBe("El nivel tiene cursos asociados.");
    expect(audit.events).toHaveLength(0);
    const rows = await fx.db
      .select()
      .from(schema.gradeLevel)
      .where(eq(schema.gradeLevel.id, level.id));
    expect(rows).toHaveLength(1);
  });

  test("list orders by campus name, orderNum, name; filters by campus; counts courses", async () => {
    const t = await fx.provisionTenant("Orden", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const zeta = await seedCampus(fx, t, "Zeta");
    const alfa = await seedCampus(fx, t, "Alfa");
    await seedLevel(fx, t, zeta.id, { name: "Z1", orderNum: 0 });
    await seedLevel(fx, t, alfa.id, { name: "B", orderNum: 1 });
    const a = await seedLevel(fx, t, alfa.id, { name: "A", orderNum: 1 });
    await seedLevel(fx, t, alfa.id, { name: "C", orderNum: 0 });
    await fx.db.insert(schema.course).values({
      organizationId: t.orgId,
      campusId: alfa.id,
      levelId: a.id,
      name: "1A",
      academicYear: "2026",
      shift: "Mañana",
    });
    const all = await call(levelRouter.list, {}, { context: ctx });
    expect(all.map((r) => r.name)).toEqual(["C", "A", "B", "Z1"]);
    expect(all.find((r) => r.name === "A")?.courseCount).toBe(1);
    const filtered = await call(levelRouter.list, { campusId: zeta.id }, { context: ctx });
    expect(filtered.map((r) => r.name)).toEqual(["Z1"]);
  });

  test("the coordinator lists but cannot create", async () => {
    expect(await call(levelRouter.list, {}, { context: coordinator })).toBeArray();
    const campus = await seedCampus(fx, tenant);
    const error = await errorOf(
      call(
        levelRouter.create,
        { campusId: campus.id, name: "x", orderNum: 0 },
        { context: coordinator },
      ),
    );
    expect(error?.code).toBe("FORBIDDEN");
  });
});

await testPermissionMatrix({
  name: "level",
  procedures: [
    {
      name: "level.list",
      permissions: { level: ["read"] },
      run: (context) => call(levelRouter.list, {}, { context }),
    },
    {
      name: "level.create",
      permissions: { level: ["create"] },
      run: (context) =>
        call(levelRouter.create, { campusId: "missing", name: "x", orderNum: 0 }, { context }),
    },
    {
      name: "level.update",
      permissions: { level: ["update"] },
      run: (context) =>
        call(levelRouter.update, { id: "missing", name: "x", orderNum: 0 }, { context }),
    },
    {
      name: "level.delete",
      permissions: { level: ["delete"] },
      run: (context) => call(levelRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { campusId: string; levelId: string; levelName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const level = await seedLevel(fx, tenant, campus.id);
  return { campusId: campus.id, levelId: level.id, levelName: level.name };
};
const levelUntouched = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.gradeLevel)
    .where(eq(schema.gradeLevel.id, foreign.levelId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.levelName);
};

await testTenantIsolation({
  name: "level",
  cases: [
    isolationCase({
      name: "level.list never returns the other tenant's levels",
      seed,
      run: ({ context }) => call(levelRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.levelId, foreign.levelName, foreign.campusId],
    }),
    isolationCase({
      name: "level.list filtered by a foreign campus returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(levelRouter.list, { campusId: foreign.campusId }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.levelId, foreign.levelName],
    }),
    isolationCase({
      name: "level.create under a foreign campus is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(
          levelRouter.create,
          { campusId: foreign.campusId, name: "Intruso", orderNum: 0 },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: async (foreign, fx) => {
        const rows = await fx.db
          .select()
          .from(schema.gradeLevel)
          .where(eq(schema.gradeLevel.campusId, foreign.campusId));
        expect(rows).toHaveLength(1);
      },
    }),
    isolationCase({
      name: "level.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          levelRouter.update,
          { id: foreign.levelId, name: "Hackeado", orderNum: 9 },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: levelUntouched,
    }),
    isolationCase({
      name: "level.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) => call(levelRouter.delete, { id: foreign.levelId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: levelUntouched,
    }),
  ],
});
