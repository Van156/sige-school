import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import type { Context } from "../../context";
import type { GradeRecalculationPort } from "../../sige/grade-recalculation";
import {
  isolationCase,
  racingDb,
  sigeSuite,
  testPermissionMatrix,
  testTenantIsolation,
} from "../../sige/testing";
import type { SigeTestFixture, TestTenant } from "../../sige/testing";
import { criterionRouter } from "./criterion";

/** `criterion.*` (sige/02 INS-17/18, §3.3, §3.4, INS-R7): CRUD, Σ total, recompute port, audit. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const seedCriterion = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.gradeCriterion.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.gradeCriterion)
    .values({
      organizationId: tenant.orgId,
      name: `Criterio ${crypto.randomUUID()}`,
      weight: "20",
      orderNum: 1,
      ...values,
    })
    .returning();
  return row!;
};

/** Records every recompute call; `affected` is what the (future) module 06 would report. */
const spyPort = (affected = 0) => {
  const calls: unknown[] = [];
  const port: GradeRecalculationPort = {
    recomputeFinals: async (input) => {
      calls.push(input);
      return { affectedFinals: affected };
    },
  };
  return { port, calls };
};

await sigeSuite("criterion router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let teacher: Context;
  let audit: RecordingAuditLogger;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Criterios", ["owner", "teacher"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    teacher = await fx.contextFor(tenant.people.teacher!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
  });

  test("create returns numeric weight, trims, treats blank description as absent, audits once", async () => {
    audit.reset();
    const created = await call(
      criterionRouter.create,
      { name: " Seguimiento ", weight: 20, description: " ", orderNum: 1 },
      { context: owner },
    );
    expect(created).toEqual({
      id: expect.any(String),
      name: "Seguimiento",
      weight: 20,
      description: null,
      orderNum: 1,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "criterion.created",
      targetType: "criterion",
      targetId: created.id,
      organizationId: tenant.orgId,
    });
  });

  test("saving never blocks on a total different from 100; totalWeight is exact", async () => {
    const t = await fx.provisionTenant("Suma", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const empty = await call(criterionRouter.list, undefined, { context: ctx });
    expect(empty).toEqual({ rows: [], totalWeight: 0 });
    for (const [i, weight] of [33.33, 33.33].entries()) {
      await call(
        criterionRouter.create,
        { name: `C${i}`, weight, orderNum: i + 1 },
        { context: ctx },
      );
    }
    const partial = await call(criterionRouter.list, undefined, { context: ctx });
    expect(partial.totalWeight).toBe(66.66);
    await call(
      criterionRouter.create,
      { name: "C3", weight: 33.34, orderNum: 3 },
      { context: ctx },
    );
    const full = await call(criterionRouter.list, undefined, { context: ctx });
    expect(full.totalWeight).toBe(100);
    expect(full.rows.map((r) => r.weight)).toEqual([33.33, 33.33, 33.34]);
    await call(criterionRouter.create, { name: "C4", weight: 50, orderNum: 4 }, { context: ctx });
    expect((await call(criterionRouter.list, undefined, { context: ctx })).totalWeight).toBe(150);
  });

  test("weight boundaries: 0 and 100.01 rejected, 0.01 and 100 accepted", async () => {
    const t = await fx.provisionTenant("Pesos", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    for (const weight of [0, 100.01, -1]) {
      const error = await errorOf(
        call(criterionRouter.create, { name: "x", weight, orderNum: 1 }, { context: ctx }),
      );
      expect(error?.code).toBe("BAD_REQUEST");
      expect(JSON.stringify(error?.data)).toContain(
        "El peso debe ser mayor a 0 y menor o igual a 100.",
      );
    }
    for (const weight of [0.01, 100]) {
      const row = await call(
        criterionRouter.create,
        { name: `w${weight}`, weight, orderNum: 1 },
        { context: ctx },
      );
      expect(row.weight).toBe(weight);
    }
  });

  test("list orders by orderNum then name", async () => {
    const t = await fx.provisionTenant("Orden", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    await seedCriterion(fx, t, { name: "B", orderNum: 2 });
    await seedCriterion(fx, t, { name: "Z", orderNum: 1 });
    await seedCriterion(fx, t, { name: "A", orderNum: 2 });
    const { rows } = await call(criterionRouter.list, undefined, { context: ctx });
    expect(rows.map((r) => r.name)).toEqual(["Z", "A", "B"]);
  });

  test("create and delete call the recompute port once with scope open", async () => {
    const { port, calls } = spyPort();
    const ctx = { ...owner, gradeRecalculation: port } as Context;
    const created = await call(
      criterionRouter.create,
      { name: "Hook", weight: 10, orderNum: 9 },
      { context: ctx },
    );
    expect(calls).toEqual([{ scope: "open" }]);
    await call(criterionRouter.delete, { id: created.id }, { context: ctx });
    expect(calls).toEqual([{ scope: "open" }, { scope: "open" }]);
  });

  test("update returns affectedFinals (0 with the default port), audits weight and affectedFinals", async () => {
    const criterion = await seedCriterion(fx, tenant, { name: "Vieja", weight: "20" });
    audit.reset();
    const updated = await call(
      criterionRouter.update,
      { id: criterion.id, name: "Nueva", weight: 25, orderNum: 1 },
      { context: owner },
    );
    expect(updated).toMatchObject({
      id: criterion.id,
      name: "Nueva",
      weight: 25,
      affectedFinals: 0,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("criterion.updated");
    expect(audit.events[0]?.metadata).toMatchObject({
      affectedFinals: 0,
      changes: { weight: { from: 20, to: 25 }, name: { from: "Vieja", to: "Nueva" } },
    });
  });

  test("update reports the port's count and recomputes only when the weight changed", async () => {
    const criterion = await seedCriterion(fx, tenant, { name: "Peso", weight: "20" });
    const { port, calls } = spyPort(7);
    const ctx = { ...owner, gradeRecalculation: port } as Context;
    const renamed = await call(
      criterionRouter.update,
      { id: criterion.id, name: "Peso 2", weight: 20, orderNum: 1 },
      { context: ctx },
    );
    expect(calls).toHaveLength(0);
    expect(renamed.affectedFinals).toBe(0);
    const reweighted = await call(
      criterionRouter.update,
      { id: criterion.id, name: "Peso 2", weight: 30, orderNum: 1 },
      { context: ctx },
    );
    expect(calls).toEqual([{ scope: "open" }]);
    expect(reweighted.affectedFinals).toBe(7);
  });

  test("a failing recompute rolls the write back and audits nothing", async () => {
    const criterion = await seedCriterion(fx, tenant, { name: "Atómico", weight: "20" });
    const ctx = {
      ...owner,
      gradeRecalculation: {
        recomputeFinals: async () => {
          throw new Error("recompute failed");
        },
      },
    } as Context;
    audit.reset();
    const error = await errorOf(
      call(
        criterionRouter.update,
        { id: criterion.id, name: "Atómico", weight: 60, orderNum: 1 },
        { context: ctx },
      ),
    );
    expect(error?.message).toContain("recompute failed");
    const [row] = await fx.db
      .select()
      .from(schema.gradeCriterion)
      .where(eq(schema.gradeCriterion.id, criterion.id));
    expect(Number(row?.weight)).toBe(20);
    expect(audit.events).toHaveLength(0);
  });

  test("get/update/delete of a missing id is NOT_FOUND", async () => {
    for (const run of [
      () => call(criterionRouter.get, { id: "nope" }, { context: owner }),
      () =>
        call(
          criterionRouter.update,
          { id: "nope", name: "x", weight: 1, orderNum: 1 },
          { context: owner },
        ),
      () => call(criterionRouter.delete, { id: "nope" }, { context: owner }),
    ]) {
      expect((await errorOf(run()))?.code).toBe("NOT_FOUND");
    }
  });

  test("delete removes the row and snapshots name and weight", async () => {
    const criterion = await seedCriterion(fx, tenant, { weight: "12.5" });
    audit.reset();
    expect(await call(criterionRouter.delete, { id: criterion.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "criterion.deleted",
      metadata: { snapshot: { name: criterion.name, weight: 12.5 } },
    });
  });

  test("update/delete lose a race to a concurrent delete: NOT_FOUND, no audit", async () => {
    for (const op of ["update", "delete"] as const) {
      const criterion = await seedCriterion(fx, tenant);
      const { port } = spyPort();
      const racing = {
        ...owner,
        gradeRecalculation: port,
        db: racingDb(fx.db, async () => {
          await fx.db
            .delete(schema.gradeCriterion)
            .where(eq(schema.gradeCriterion.id, criterion.id));
        }),
      } as Context;
      audit.reset();
      const run =
        op === "update"
          ? call(
              criterionRouter.update,
              { id: criterion.id, name: "x", weight: 50, orderNum: 1 },
              { context: racing },
            )
          : call(criterionRouter.delete, { id: criterion.id }, { context: racing });
      expect((await errorOf(run))?.code).toBe("NOT_FOUND");
      expect(audit.events).toHaveLength(0);
    }
  });

  test("the teacher lists and gets but cannot mutate", async () => {
    const criterion = await seedCriterion(fx, tenant);
    expect((await call(criterionRouter.list, undefined, { context: teacher })).rows).toBeArray();
    expect((await call(criterionRouter.get, { id: criterion.id }, { context: teacher })).id).toBe(
      criterion.id,
    );
    const error = await errorOf(
      call(criterionRouter.create, { name: "x", weight: 1, orderNum: 1 }, { context: teacher }),
    );
    expect(error?.code).toBe("FORBIDDEN");
  });
});

await testPermissionMatrix({
  name: "criterion",
  procedures: [
    {
      name: "criterion.list",
      permissions: { criterion: ["read"] },
      run: (context) => call(criterionRouter.list, undefined, { context }),
    },
    {
      name: "criterion.get",
      permissions: { criterion: ["read"] },
      run: (context) => call(criterionRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "criterion.create",
      permissions: { criterion: ["create"] },
      run: (context) =>
        call(criterionRouter.create, { name: "x", weight: 1, orderNum: 1 }, { context }),
    },
    {
      name: "criterion.update",
      permissions: { criterion: ["update"] },
      run: (context) =>
        call(
          criterionRouter.update,
          { id: "missing", name: "x", weight: 1, orderNum: 1 },
          { context },
        ),
    },
    {
      name: "criterion.delete",
      permissions: { criterion: ["delete"] },
      run: (context) => call(criterionRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { criterionId: string; criterionName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const criterion = await seedCriterion(fx, tenant);
  return { criterionId: criterion.id, criterionName: criterion.name };
};
const untouched = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.gradeCriterion)
    .where(eq(schema.gradeCriterion.id, foreign.criterionId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.criterionName);
  expect(Number(rows[0]?.weight)).toBe(20);
};

await testTenantIsolation({
  name: "criterion",
  cases: [
    isolationCase({
      name: "criterion.list never returns (or sums) the other tenant's criteria",
      seed,
      run: ({ context }) => call(criterionRouter.list, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.criterionId, foreign.criterionName],
    }),
    isolationCase({
      name: "criterion.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(criterionRouter.get, { id: foreign.criterionId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "criterion.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          criterionRouter.update,
          { id: foreign.criterionId, name: "Hackeado", weight: 99, orderNum: 9 },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
    isolationCase({
      name: "criterion.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(criterionRouter.delete, { id: foreign.criterionId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
  ],
});
