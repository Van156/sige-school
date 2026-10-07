import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "bun:test";

import type { Context } from "../../context";
import {
  isolationCase,
  racingDb,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import { campusRouter } from "./campus";

/** `campus.*` (sige/02 INS-07/08, §3.3, §4): CRUD, the one-main rule, delete blocks, audit. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error instanceof ORPCError ? error : (error as Error)),
  );

const seedCampus = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.campus.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.campus)
    .values({ organizationId: tenant.orgId, name: `Sede ${crypto.randomUUID()}`, ...values })
    .returning();
  return row!;
};

const seedLevel = async (fx: SigeTestFixture, tenant: TestTenant, campusId: string) => {
  const [row] = await fx.db
    .insert(schema.gradeLevel)
    .values({ organizationId: tenant.orgId, campusId, name: `Nivel ${crypto.randomUUID()}` })
    .returning();
  return row!;
};

await sigeSuite("campus router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let audit: RecordingAuditLogger;

  // Bun runs nested describes before a suite's direct tests: keep every test inside a describe.
  describe("setup", () => {
    test("provisions a tenant", async () => {
      tenant = await fx.provisionTenant("Sedes", ["owner", "coordinator"]);
      owner = await fx.contextFor(tenant.people.owner!, tenant);
      coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
      audit = owner.auditLogger as RecordingAuditLogger;
    });
  });

  describe("create / get / update / delete", () => {
    test("create applies defaults, trims and returns the row; one audit event", async () => {
      audit.reset();
      const created = await call(
        campusRouter.create,
        { name: "  Sede Norte  ", jornada: "manana", code: "", address: "Calle 1" },
        { context: owner },
      );
      expect(created).toMatchObject({
        name: "Sede Norte",
        code: null,
        address: "Calle 1",
        jornada: "manana",
        isMain: false,
        active: true,
        courseCount: 0,
      });
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0]).toMatchObject({
        scope: "organization",
        organizationId: tenant.orgId,
        actorUserId: tenant.people.owner!.userId,
        action: "campus.created",
        targetType: "campus",
        targetId: created.id,
      });
      expect(audit.events[0]?.metadata).toMatchObject({ after: { name: "Sede Norte" } });
      expect(await call(campusRouter.get, { id: created.id }, { context: coordinator })).toEqual(
        created,
      );
    });

    test("update records before/after of the changed fields only", async () => {
      const campus = await seedCampus(fx, tenant, { name: "Vieja", code: "V1" });
      audit.reset();
      const updated = await call(
        campusRouter.update,
        { id: campus.id, name: "Nueva", code: "V1", jornada: "completa", active: false },
        { context: owner },
      );
      expect(updated).toMatchObject({ name: "Nueva", active: false, code: "V1" });
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0]?.action).toBe("campus.updated");
      expect(audit.events[0]?.metadata).toMatchObject({
        changes: { name: { from: "Vieja", to: "Nueva" }, active: { from: true, to: false } },
      });
      const metadata = audit.events[0]?.metadata as { changes: Record<string, unknown> };
      expect(Object.keys(metadata.changes)).toEqual(["name", "active"]);
    });

    test("update clears optional fields left out", async () => {
      const campus = await seedCampus(fx, tenant, { code: "ZZ", address: "x" });
      const updated = await call(
        campusRouter.update,
        { id: campus.id, name: campus.name, jornada: "completa" },
        { context: owner },
      );
      expect(updated).toMatchObject({ code: null, address: null });
    });

    test("an impersonated session records the impersonator", async () => {
      const campus = await seedCampus(fx, tenant);
      const impersonated: Context = {
        ...owner,
        session: {
          ...owner.session!,
          session: { ...owner.session!.session, impersonatedBy: "root-user" },
        },
      };
      audit.reset();
      await call(campusRouter.delete, { id: campus.id }, { context: impersonated });
      expect(audit.events[0]).toMatchObject({
        action: "campus.deleted",
        impersonatorUserId: "root-user",
        metadata: { snapshot: { name: campus.name } },
      });
    });

    test("delete returns { deleted: true } and removes the row", async () => {
      const campus = await seedCampus(fx, tenant);
      expect(await call(campusRouter.delete, { id: campus.id }, { context: owner })).toEqual({
        deleted: true,
      });
      const rows = await fx.db.select().from(schema.campus).where(eq(schema.campus.id, campus.id));
      expect(rows).toHaveLength(0);
    });

    test("get/update/delete of a missing id is NOT_FOUND", async () => {
      for (const run of [
        () => call(campusRouter.get, { id: "nope" }, { context: owner }),
        () =>
          call(
            campusRouter.update,
            { id: "nope", name: "x", jornada: "completa" },
            { context: owner },
          ),
        () => call(campusRouter.delete, { id: "nope" }, { context: owner }),
      ]) {
        expect(((await errorOf(run())) as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
      }
    });

    test("update/delete lose a race to a concurrent delete: NOT_FOUND and no audit", async () => {
      for (const op of ["update", "delete"] as const) {
        const campus = await seedCampus(fx, tenant);
        const racing = {
          ...owner,
          db: racingDb(fx.db, async () => {
            await fx.db.delete(schema.campus).where(eq(schema.campus.id, campus.id));
          }),
        } as Context;
        audit.reset();
        const run =
          op === "update"
            ? call(
                campusRouter.update,
                { id: campus.id, name: "Tarde", jornada: "completa" },
                { context: racing },
              )
            : call(campusRouter.delete, { id: campus.id }, { context: racing });
        expect(((await errorOf(run)) as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
        expect(audit.events).toHaveLength(0);
      }
    });

    test("validation: blank name is rejected with the spec message", async () => {
      const error = (await errorOf(
        call(campusRouter.create, { name: " ", jornada: "completa" }, { context: owner }),
      )) as ORPCError<string, any>;
      expect(error.code).toBe("BAD_REQUEST");
      expect(JSON.stringify(error.data)).toContain("El nombre de la sede es obligatorio.");
    });
  });

  describe("one main campus (INS-R2)", () => {
    test("a second main is a CONFLICT and nothing is swapped", async () => {
      const main = await call(
        campusRouter.create,
        { name: "Principal", jornada: "completa", isMain: true },
        { context: owner },
      );
      const error = (await errorOf(
        call(
          campusRouter.create,
          { name: "Otra principal", jornada: "completa", isMain: true },
          { context: owner },
        ),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("CONFLICT");
      expect(error.status).toBe(409);
      expect(error.message).toBe("Ya existe una sede principal en esta institución.");
      const [row] = await fx.db.select().from(schema.campus).where(eq(schema.campus.id, main.id));
      expect(row?.isMain).toBe(true);
    });

    test("flagging another campus main via update is a CONFLICT", async () => {
      const other = await seedCampus(fx, tenant);
      const error = (await errorOf(
        call(
          campusRouter.update,
          { id: other.id, name: other.name, jornada: "completa", isMain: true },
          { context: owner },
        ),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("Ya existe una sede principal en esta institución.");
    });

    test("concurrent double-flag leaves exactly one main", async () => {
      await fx.db
        .update(schema.campus)
        .set({ isMain: false })
        .where(eq(schema.campus.organizationId, tenant.orgId));
      const results = await Promise.allSettled(
        ["A", "B", "C"].map((name) =>
          call(
            campusRouter.create,
            { name: `Race ${name}`, jornada: "completa", isMain: true },
            { context: owner },
          ),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      expect(rejected.every((r) => r.reason.code === "CONFLICT")).toBe(true);
      const mains = await fx.db
        .select()
        .from(schema.campus)
        .where(eq(schema.campus.organizationId, tenant.orgId));
      expect(mains.filter((c) => c.isMain)).toHaveLength(1);
    });

    test("the main campus is deletable when it has no dependents", async () => {
      await fx.db
        .update(schema.campus)
        .set({ isMain: false })
        .where(eq(schema.campus.organizationId, tenant.orgId));
      const main = await seedCampus(fx, tenant, { isMain: true });
      expect(await call(campusRouter.delete, { id: main.id }, { context: owner })).toEqual({
        deleted: true,
      });
    });
  });

  describe("uniqueness", () => {
    test("duplicate code is a CONFLICT with the spec message", async () => {
      await seedCampus(fx, tenant, { code: "DUP" });
      const error = (await errorOf(
        call(
          campusRouter.create,
          { name: "Otra", jornada: "completa", code: "DUP" },
          { context: owner },
        ),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("Ya existe una sede con este código.");
    });
  });

  describe("delete blocks (INS-R, §4.2)", () => {
    test("a campus with levels is HAS_DEPENDENTS and stays intact", async () => {
      const campus = await seedCampus(fx, tenant);
      await seedLevel(fx, tenant, campus.id);
      audit.reset();
      const error = (await errorOf(
        call(campusRouter.delete, { id: campus.id }, { context: owner }),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("HAS_DEPENDENTS");
      expect(error.status).toBe(409);
      expect(error.message).toBe("La sede tiene niveles o grados asociados.");
      expect(audit.events).toHaveLength(0);
      const rows = await fx.db.select().from(schema.campus).where(eq(schema.campus.id, campus.id));
      expect(rows).toHaveLength(1);
    });

    test("a campus with courses is HAS_DEPENDENTS", async () => {
      const campus = await seedCampus(fx, tenant);
      await fx.db.insert(schema.course).values({
        organizationId: tenant.orgId,
        campusId: campus.id,
        name: "5A",
        academicYear: "2026",
        shift: "Mañana",
      });
      const error = (await errorOf(
        call(campusRouter.delete, { id: campus.id }, { context: owner }),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("HAS_DEPENDENTS");
    });
  });

  describe("list and options", () => {
    test("list: main first, then by name, with inactive flag and courseCount", async () => {
      const t = await fx.provisionTenant("Listas", ["owner"]);
      const ctx = await fx.contextFor(t.people.owner!, t);
      const b = await seedCampus(fx, t, { name: "Beta" });
      await seedCampus(fx, t, { name: "Alfa", active: false });
      await seedCampus(fx, t, { name: "Zeta", isMain: true });
      await fx.db.insert(schema.course).values({
        organizationId: t.orgId,
        campusId: b.id,
        name: "1A",
        academicYear: "2026",
        shift: "Tarde",
      });
      const rows = await call(campusRouter.list, undefined, { context: ctx });
      expect(rows.map((r) => r.name)).toEqual(["Zeta", "Alfa", "Beta"]);
      expect(rows.find((r) => r.name === "Alfa")?.active).toBe(false);
      expect(rows.find((r) => r.name === "Beta")?.courseCount).toBe(1);
    });

    test("options: active campuses only (INS-R3)", async () => {
      const t = await fx.provisionTenant("Opciones", ["owner"]);
      const ctx = await fx.contextFor(t.people.owner!, t);
      await seedCampus(fx, t, { name: "Activa" });
      await seedCampus(fx, t, { name: "Inactiva", active: false });
      const options = await call(campusRouter.options, undefined, { context: ctx });
      expect(options.map((o) => o.name)).toEqual(["Activa"]);
      expect(Object.keys(options[0]!).sort()).toEqual(["id", "isMain", "name"]);
    });
  });

  describe("coordinator", () => {
    test("reads but cannot mutate", async () => {
      expect(await call(campusRouter.list, undefined, { context: coordinator })).toBeArray();
      const error = (await errorOf(
        call(campusRouter.create, { name: "x", jornada: "completa" }, { context: coordinator }),
      )) as ORPCError<string, unknown>;
      expect(error.code).toBe("FORBIDDEN");
    });
  });
});

await testPermissionMatrix({
  name: "campus",
  procedures: [
    {
      name: "campus.list",
      permissions: { campus: ["read"] },
      run: (context) => call(campusRouter.list, undefined, { context }),
    },
    {
      name: "campus.get",
      permissions: { campus: ["read"] },
      run: (context) => call(campusRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "campus.options",
      permissions: { campus: ["read"] },
      run: (context) => call(campusRouter.options, undefined, { context }),
    },
    {
      name: "campus.create",
      permissions: { campus: ["create"] },
      run: (context) =>
        call(
          campusRouter.create,
          { name: `Matriz ${crypto.randomUUID()}`, jornada: "completa" },
          { context },
        ),
    },
    {
      name: "campus.update",
      permissions: { campus: ["update"] },
      run: (context) =>
        call(campusRouter.update, { id: "missing", name: "x", jornada: "completa" }, { context }),
    },
    {
      name: "campus.delete",
      permissions: { campus: ["delete"] },
      run: (context) => call(campusRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { campusId: string; campusName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  return { campusId: campus.id, campusName: campus.name };
};
const stillThere = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.campus)
    .where(eq(schema.campus.id, foreign.campusId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.campusName);
};

await testTenantIsolation({
  name: "campus",
  cases: [
    isolationCase({
      name: "campus.list never returns the other tenant's campuses",
      seed,
      run: ({ context }) => call(campusRouter.list, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.campusId, foreign.campusName],
    }),
    isolationCase({
      name: "campus.options never returns the other tenant's campuses",
      seed,
      run: ({ context }) => call(campusRouter.options, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.campusId, foreign.campusName],
    }),
    isolationCase({
      name: "campus.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) => call(campusRouter.get, { id: foreign.campusId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "campus.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          campusRouter.update,
          { id: foreign.campusId, name: "Hackeada", jornada: "tarde" },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: stillThere,
    }),
    isolationCase({
      name: "campus.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(campusRouter.delete, { id: foreign.campusId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: stillThere,
    }),
  ],
});
