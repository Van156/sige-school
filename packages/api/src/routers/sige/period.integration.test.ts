import { call, ORPCError } from "@orpc/server";
import * as schema from "@base-template/db/schema";
import type { RecordingAuditLogger } from "@base-template/auth/testing";
import { and, eq } from "drizzle-orm";
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
import {
  seedAcademicPeriod,
  seedCriterion,
  seedFinalGrade,
  seedGradeRecord,
  seedPeriodLock,
} from "../../sige/testing/academic-seed";
import {
  seedCampus,
  seedCourse,
  seedOffering,
  seedStudent,
  seedSubject,
} from "../../sige/testing/scheduling-seed";
import { periodRouter } from "./period";

/** `period.*` (sige/02 INS-15/16, §3.3, INS-R5, INS-R9): CRUD, atomic activate, overlap, audit. */

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
  );

const input = (values: Record<string, unknown> = {}) => ({
  academicYear: "2026",
  orderNum: 1,
  name: "Primer Periodo",
  shortName: "P1",
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  isActive: false,
  ...values,
});

const seedPeriod = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  values: Partial<typeof schema.academicPeriod.$inferInsert> = {},
) => {
  const n = crypto.randomUUID().slice(0, 8);
  const [row] = await fx.db
    .insert(schema.academicPeriod)
    .values({
      organizationId: tenant.orgId,
      academicYear: "2026",
      orderNum: 1,
      name: `Periodo ${n}`,
      shortName: n,
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      ...values,
    })
    .returning();
  return row!;
};

const activeIds = async (fx: SigeTestFixture, tenant: TestTenant) =>
  (
    await fx.db
      .select({ id: schema.academicPeriod.id })
      .from(schema.academicPeriod)
      .where(
        and(
          eq(schema.academicPeriod.organizationId, tenant.orgId),
          eq(schema.academicPeriod.isActive, true),
        ),
      )
  ).map((row) => row.id);

const newTenant = async (fx: SigeTestFixture, label: string) => {
  const tenant = await fx.provisionTenant(label, ["owner"]);
  const context = await fx.contextFor(tenant.people.owner!, tenant);
  return { tenant, context, audit: context.auditLogger as RecordingAuditLogger };
};

await sigeSuite("period router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let coordinator: Context;
  let audit: RecordingAuditLogger;

  test("provisions a tenant", async () => {
    tenant = await fx.provisionTenant("Periodos", ["owner", "coordinator"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    coordinator = await fx.contextFor(tenant.people.coordinator!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
  });

  test("create returns the row, trims and audits once", async () => {
    const t = await newTenant(fx, "Crear");
    t.audit.reset();
    const created = await call(
      periodRouter.create,
      input({ name: "  Primero ", shortName: " P1 " }),
      { context: t.context },
    );
    expect(created).toEqual({
      id: expect.any(String),
      academicYear: "2026",
      orderNum: 1,
      name: "Primero",
      shortName: "P1",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      isActive: false,
    });
    expect(t.audit.events).toHaveLength(1);
    expect(t.audit.events[0]).toMatchObject({
      action: "period.created",
      targetType: "period",
      targetId: created.id,
      organizationId: t.tenant.orgId,
    });
  });

  test("list orders by year desc then orderNum and filters by academic year", async () => {
    const t = await newTenant(fx, "Lista");
    await seedPeriod(fx, t.tenant, { academicYear: "2025", orderNum: 1, shortName: "A1" });
    await seedPeriod(fx, t.tenant, {
      academicYear: "2026",
      orderNum: 2,
      shortName: "B2",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });
    await seedPeriod(fx, t.tenant, { academicYear: "2026", orderNum: 1, shortName: "B1" });
    const all = await call(periodRouter.list, {}, { context: t.context });
    expect(all.map((r) => r.shortName)).toEqual(["B1", "B2", "A1"]);
    const only = await call(periodRouter.list, { academicYear: "2025" }, { context: t.context });
    expect(only.map((r) => r.shortName)).toEqual(["A1"]);
  });

  test("summary counts periods per year and carries the warning below four", async () => {
    const t = await newTenant(fx, "Resumen");
    const dates = [
      ["2026-01-01", "2026-03-31"],
      ["2026-04-01", "2026-06-30"],
      ["2026-07-01", "2026-09-30"],
      ["2026-10-01", "2026-12-15"],
    ] as const;
    for (const [i, [startDate, endDate]] of dates.entries()) {
      await seedPeriod(fx, t.tenant, {
        orderNum: i + 1,
        shortName: `P${i + 1}`,
        startDate,
        endDate,
      });
    }
    await seedPeriod(fx, t.tenant, { academicYear: "2025", orderNum: 1, shortName: "P1" });
    const summary = await call(periodRouter.summary, undefined, { context: t.context });
    expect(summary).toEqual([
      { academicYear: "2026", periodCount: 4, warning: null },
      {
        academicYear: "2025",
        periodCount: 1,
        warning: "Este año tiene 1 de 4 periodos.",
      },
    ]);
  });

  test("overlap compares closed ranges: touching dates overlap, the next day does not", async () => {
    const t = await newTenant(fx, "Solape");
    await seedPeriod(fx, t.tenant, {
      name: "Existente",
      shortName: "E",
      orderNum: 1,
      startDate: "2026-01-10",
      endDate: "2026-02-10",
    });
    const attempt = (orderNum: number, startDate: string, endDate: string, year = "2026") =>
      errorOf(
        call(
          periodRouter.create,
          input({
            orderNum,
            shortName: `N${orderNum}${year}`,
            startDate,
            endDate,
            academicYear: year,
          }),
          { context: t.context },
        ),
      );
    for (const [start, end] of [
      ["2026-02-10", "2026-03-01"], // starts on the existing end date
      ["2025-12-01", "2026-01-10"], // ends on the existing start date
      ["2026-01-15", "2026-01-20"], // inside
      ["2026-01-01", "2026-03-01"], // contains
    ] as const) {
      const error = await attempt(2, start, end);
      expect(error?.code).toBe("CONFLICT");
      expect(error?.status).toBe(409);
      expect(error?.message).toBe("Las fechas se superponen con el periodo Existente.");
    }
    expect(await attempt(2, "2026-02-11", "2026-03-01")).toBeNull();
    expect(await attempt(3, "2025-12-01", "2026-01-09")).toBeNull();
    // Same dates in another academic year do not overlap.
    expect(await attempt(1, "2026-01-10", "2026-02-10", "2027")).toBeNull();
  });

  test("update excludes itself from the overlap check and rejects moving into a neighbour", async () => {
    const t = await newTenant(fx, "SolapeUpd");
    const a = await seedPeriod(fx, t.tenant, {
      orderNum: 1,
      shortName: "A",
      name: "Alfa",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });
    const b = await seedPeriod(fx, t.tenant, {
      orderNum: 2,
      shortName: "B",
      name: "Beta",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });
    const same = await call(
      periodRouter.update,
      { id: a.id, ...input({ shortName: "A", name: "Alfa", endDate: "2026-03-30" }) },
      { context: t.context },
    );
    expect(same.endDate).toBe("2026-03-30");
    t.audit.reset();
    const error = await errorOf(
      call(
        periodRouter.update,
        {
          id: b.id,
          ...input({
            orderNum: 2,
            shortName: "B",
            name: "Beta",
            startDate: "2026-03-30",
            endDate: "2026-06-30",
          }),
        },
        { context: t.context },
      ),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Las fechas se superponen con el periodo Alfa.");
    expect(t.audit.events).toHaveLength(0);
  });

  test("moving a period to another year checks overlap in the new year", async () => {
    const t = await newTenant(fx, "Cambio");
    await seedPeriod(fx, t.tenant, { academicYear: "2027", shortName: "X", name: "Equis" });
    const p = await seedPeriod(fx, t.tenant, { academicYear: "2026", shortName: "Y", orderNum: 2 });
    const error = await errorOf(
      call(
        periodRouter.update,
        { id: p.id, ...input({ academicYear: "2027", orderNum: 2, shortName: "Y" }) },
        { context: t.context },
      ),
    );
    expect(error?.message).toBe("Las fechas se superponen con el periodo Equis.");
  });

  test("duplicate order or short name in a year is a CONFLICT (D6)", async () => {
    const t = await newTenant(fx, "Dup");
    await seedPeriod(fx, t.tenant, { orderNum: 1, shortName: "P1" });
    const base = { startDate: "2026-05-01", endDate: "2026-06-01" };
    const order = await errorOf(
      call(periodRouter.create, input({ ...base, orderNum: 1, shortName: "Z" }), {
        context: t.context,
      }),
    );
    expect(order?.code).toBe("CONFLICT");
    expect(order?.message).toBe("Ya existe un periodo con este orden en el año.");
    const short = await errorOf(
      call(periodRouter.create, input({ ...base, orderNum: 2, shortName: "P1" }), {
        context: t.context,
      }),
    );
    expect(short?.code).toBe("CONFLICT");
    expect(short?.message).toBe("Ya existe un periodo con este nombre corto en el año.");
  });

  test("the first period can be created active; a second active one is a CONFLICT", async () => {
    const t = await newTenant(fx, "Activo");
    const first = await call(periodRouter.create, input({ isActive: true }), {
      context: t.context,
    });
    expect(first.isActive).toBe(true);
    const error = await errorOf(
      call(
        periodRouter.create,
        input({
          orderNum: 2,
          shortName: "P2",
          startDate: "2026-04-01",
          endDate: "2026-06-30",
          isActive: true,
        }),
        { context: t.context },
      ),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Ya existe un periodo activo en esta institución.");
    expect(await activeIds(fx, t.tenant)).toEqual([first.id]);
  });

  test("activate swaps the active period in one step and audits once", async () => {
    const t = await newTenant(fx, "Activar");
    const a = await seedPeriod(fx, t.tenant, { orderNum: 1, shortName: "A", isActive: true });
    const b = await seedPeriod(fx, t.tenant, {
      orderNum: 2,
      shortName: "B",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });
    t.audit.reset();
    const activated = await call(periodRouter.activate, { id: b.id }, { context: t.context });
    expect(activated).toMatchObject({ id: b.id, isActive: true });
    expect(await activeIds(fx, t.tenant)).toEqual([b.id]);
    expect(t.audit.events).toHaveLength(1);
    expect(t.audit.events[0]).toMatchObject({
      action: "period.activated",
      targetId: b.id,
      metadata: { previousActiveId: a.id },
    });
    t.audit.reset();
    expect(await call(periodRouter.activate, { id: b.id }, { context: t.context })).toMatchObject({
      isActive: true,
    });
    expect(t.audit.events).toHaveLength(0);
  });

  test("concurrent activate calls end with exactly one active period", async () => {
    const t = await newTenant(fx, "Concurrente");
    const periods = [];
    for (let i = 0; i < 4; i += 1) {
      periods.push(
        await seedPeriod(fx, t.tenant, {
          orderNum: i + 1,
          shortName: `P${i + 1}`,
          startDate: `2026-0${i * 2 + 1}-01`,
          endDate: `2026-0${i * 2 + 2}-28`,
          isActive: i === 0,
        }),
      );
    }
    const results = await Promise.allSettled(
      periods.map((p) => call(periodRouter.activate, { id: p.id }, { context: t.context })),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await activeIds(fx, t.tenant)).toHaveLength(1);
  });

  test("concurrent overlapping creates end with one row", async () => {
    const t = await newTenant(fx, "Carrera");
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((n) =>
        call(
          periodRouter.create,
          input({ orderNum: n, shortName: `P${n}`, name: `Periodo ${n}` }),
          { context: t.context },
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") {
        expect((r.reason as ORPCError<string, unknown>).code).toBe("CONFLICT");
      }
    }
    const rows = await fx.db
      .select()
      .from(schema.academicPeriod)
      .where(eq(schema.academicPeriod.organizationId, t.tenant.orgId));
    expect(rows).toHaveLength(1);
  });

  test("deactivating the only active period is rejected; deactivating an inactive one is fine", async () => {
    const t = await newTenant(fx, "Desactivar");
    const a = await seedPeriod(fx, t.tenant, { orderNum: 1, shortName: "A", isActive: true });
    const b = await seedPeriod(fx, t.tenant, {
      orderNum: 2,
      shortName: "B",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });
    t.audit.reset();
    const error = await errorOf(
      call(
        periodRouter.update,
        { id: a.id, ...input({ shortName: "A", isActive: false }) },
        { context: t.context },
      ),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("Debe haber un periodo activo. Active otro periodo para cambiar.");
    expect(await activeIds(fx, t.tenant)).toEqual([a.id]);
    expect(t.audit.events).toHaveLength(0);
    const ok = await call(
      periodRouter.update,
      {
        id: b.id,
        ...input({ orderNum: 2, shortName: "B", startDate: "2026-04-01", endDate: "2026-06-30" }),
      },
      { context: t.context },
    );
    expect(ok.isActive).toBe(false);
  });

  test("update audits changed fields only", async () => {
    const t = await newTenant(fx, "Auditar");
    const p = await seedPeriod(fx, t.tenant, { name: "Viejo", shortName: "V" });
    t.audit.reset();
    await call(
      periodRouter.update,
      { id: p.id, ...input({ name: "Nuevo", shortName: "V" }) },
      { context: t.context },
    );
    expect(t.audit.events).toHaveLength(1);
    expect(t.audit.events[0]?.action).toBe("period.updated");
    expect(t.audit.events[0]?.metadata).toMatchObject({
      changes: { name: { from: "Viejo", to: "Nuevo" } },
    });
  });

  test("get/update/delete/activate of a missing id is NOT_FOUND", async () => {
    for (const run of [
      () => call(periodRouter.get, { id: "nope" }, { context: owner }),
      () => call(periodRouter.update, { id: "nope", ...input() }, { context: owner }),
      () => call(periodRouter.delete, { id: "nope" }, { context: owner }),
      () => call(periodRouter.activate, { id: "nope" }, { context: owner }),
    ]) {
      expect((await errorOf(run()))?.code).toBe("NOT_FOUND");
    }
  });

  test("delete removes the row and snapshots the name", async () => {
    const t = await newTenant(fx, "Borrar");
    const p = await seedPeriod(fx, t.tenant, { name: "Borrable" });
    t.audit.reset();
    expect(await call(periodRouter.delete, { id: p.id }, { context: t.context })).toEqual({
      deleted: true,
    });
    expect(t.audit.events).toHaveLength(1);
    expect(t.audit.events[0]).toMatchObject({
      action: "period.deleted",
      metadata: { snapshot: { name: "Borrable", academicYear: "2026", shortName: p.shortName } },
    });
  });

  test("delete rejects the active period: BAD_REQUEST, row kept, no audit", async () => {
    const t = await newTenant(fx, "BorrarActivo");
    const active = await seedPeriod(fx, t.tenant, { isActive: true });
    t.audit.reset();
    const error = await errorOf(
      call(periodRouter.delete, { id: active.id }, { context: t.context }),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe(
      "No se puede eliminar el periodo activo. Active otro periodo primero.",
    );
    expect(await activeIds(fx, t.tenant)).toEqual([active.id]);
    expect(t.audit.events).toHaveLength(0);
  });

  test("delete of the previously active period works once another is activated", async () => {
    const t = await newTenant(fx, "BorrarTrasActivar");
    const a = await seedPeriod(fx, t.tenant, { isActive: true });
    const b = await seedPeriod(fx, t.tenant, {
      orderNum: 2,
      shortName: "B",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });
    await call(periodRouter.activate, { id: b.id }, { context: t.context });
    expect(await call(periodRouter.delete, { id: a.id }, { context: t.context })).toEqual({
      deleted: true,
    });
    expect(await activeIds(fx, t.tenant)).toEqual([b.id]);
  });

  test("concurrent delete and activate never leave zero active periods", async () => {
    for (let round = 0; round < 5; round += 1) {
      const t = await newTenant(fx, `DelAct${round}`);
      const a = await seedPeriod(fx, t.tenant, { isActive: true });
      const b = await seedPeriod(fx, t.tenant, {
        orderNum: 2,
        shortName: "B",
        startDate: "2026-04-01",
        endDate: "2026-06-30",
      });
      const [removed] = await Promise.allSettled([
        call(periodRouter.delete, { id: a.id }, { context: t.context }),
        call(periodRouter.activate, { id: b.id }, { context: t.context }),
      ]);
      expect(await activeIds(fx, t.tenant)).toEqual([b.id]);
      if (removed.status === "rejected") {
        expect((removed.reason as ORPCError<string, any>).code).toBe("BAD_REQUEST");
      }
    }
  });

  test("update/delete/activate lose a race to a concurrent delete: NOT_FOUND and no audit", async () => {
    const t = await newTenant(fx, "Carrera2");
    for (const op of ["update", "delete", "activate"] as const) {
      const p = await seedPeriod(fx, t.tenant);
      const remove = async () => {
        await fx.db.delete(schema.academicPeriod).where(eq(schema.academicPeriod.id, p.id));
      };
      const racing = {
        ...t.context,
        db: racingDb(fx.db, remove, "transaction"),
      } as Context;
      t.audit.reset();
      const run =
        op === "update"
          ? call(
              periodRouter.update,
              { id: p.id, ...input({ shortName: p.shortName }) },
              { context: racing },
            )
          : op === "delete"
            ? call(periodRouter.delete, { id: p.id }, { context: racing })
            : call(periodRouter.activate, { id: p.id }, { context: racing });
      expect((await errorOf(run))?.code).toBe("NOT_FOUND");
      expect(t.audit.events).toHaveLength(0);
    }
  });

  test("validation: order 5 and end before start use the spec messages", async () => {
    const order = await errorOf(
      call(periodRouter.create, input({ orderNum: 5 }), { context: owner }),
    );
    expect(JSON.stringify(order?.data)).toContain("El orden debe estar entre 1 y 4.");
    const dates = await errorOf(
      call(periodRouter.create, input({ endDate: "2026-01-01" }), { context: owner }),
    );
    expect(JSON.stringify(dates?.data)).toContain(
      "La fecha de fin debe ser posterior a la de inicio.",
    );
  });

  test("the coordinator lists but cannot create or activate", async () => {
    expect(await call(periodRouter.list, {}, { context: coordinator })).toBeArray();
    expect(
      (await errorOf(call(periodRouter.create, input(), { context: coordinator })))?.code,
    ).toBe("FORBIDDEN");
    expect(
      (await errorOf(call(periodRouter.activate, { id: "x" }, { context: coordinator })))?.code,
    ).toBe("FORBIDDEN");
    expect(audit.events.length).toBeGreaterThanOrEqual(0);
  });
});

await sigeSuite("period.list gate (D3)", (fx) => {
  let tenant: TestTenant;
  let periodId: string;
  const callers: Partial<Record<"teacher" | "student" | "viewer", Context>> = {};

  test("provisions a tenant with a period and one caller per role", async () => {
    tenant = await fx.provisionTenant("Compuerta", ["owner", "teacher", "student", "viewer"]);
    periodId = (await seedAcademicPeriod(fx, tenant)).id;
    for (const role of ["teacher", "student", "viewer"] as const) {
      callers[role] = await fx.contextFor(tenant.people[role]!, tenant);
    }
  });

  test("a teacher reads the list through grade:read, without holding period:read", async () => {
    const rows = await call(periodRouter.list, {}, { context: callers.teacher! });
    expect(rows.map((row) => row.id)).toContain(periodId);
    // The widening is `list` only: the administrative reads still need `period:read`.
    expect(
      (await errorOf(call(periodRouter.summary, undefined, { context: callers.teacher! })))?.code,
    ).toBe("FORBIDDEN");
    expect(
      (await errorOf(call(periodRouter.get, { id: periodId }, { context: callers.teacher! })))
        ?.code,
    ).toBe("FORBIDDEN");
  });

  test("a student keeps reading it through period:read", async () => {
    const rows = await call(periodRouter.list, {}, { context: callers.student! });
    expect(rows.map((row) => row.id)).toContain(periodId);
  });

  test("a viewer holds neither permission and is still FORBIDDEN", async () => {
    expect((await errorOf(call(periodRouter.list, {}, { context: callers.viewer! })))?.code).toBe(
      "FORBIDDEN",
    );
  });
});

await sigeSuite("period delete dependents (sige/02 §4.2)", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let audit: RecordingAuditLogger;
  let world: { courseId: string; offeringId: string; studentId: string; authorPersonId: string };

  test("provisions a tenant with a course, an offering and a student", async () => {
    tenant = await fx.provisionTenant("Dependientes", ["owner", "teacher"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
    const campus = await seedCampus(fx, tenant);
    const course = await seedCourse(fx, tenant, campus.id);
    const subject = await seedSubject(fx, tenant);
    const offering = await seedOffering(fx, tenant, course.id, subject.id);
    const student = await seedStudent(fx, tenant, campus.id, { courseId: course.id });
    world = {
      courseId: course.id,
      offeringId: offering.id,
      studentId: student.id,
      authorPersonId: tenant.people.teacher!.personId,
    };
  });

  test.each(["grade", "final", "lock"] as const)(
    "delete is refused while the period has a %s row and audits nothing",
    async (kind) => {
      const period = await seedAcademicPeriod(fx, tenant);
      const common = {
        studentId: world.studentId,
        offeringId: world.offeringId,
        periodId: period.id,
      };
      if (kind === "grade") {
        const criterion = await seedCriterion(fx, tenant);
        await seedGradeRecord(fx, tenant, {
          ...common,
          criterionId: criterion.id,
          authorPersonId: world.authorPersonId,
        });
      } else if (kind === "final") {
        await seedFinalGrade(fx, tenant, common);
      } else {
        await seedPeriodLock(fx, tenant, {
          offeringId: world.offeringId,
          periodId: period.id,
          lockedBy: world.authorPersonId,
        });
      }
      audit.reset();
      const error = await errorOf(call(periodRouter.delete, { id: period.id }, { context: owner }));
      expect(error?.code).toBe("HAS_DEPENDENTS");
      expect(error?.status).toBe(409);
      expect(error?.message).toBe("El periodo tiene notas registradas.");
      expect(audit.events).toHaveLength(0);
      expect(
        await fx.db
          .select()
          .from(schema.academicPeriod)
          .where(eq(schema.academicPeriod.id, period.id)),
      ).toHaveLength(1);
    },
  );

  test("a period without academic rows is still deletable", async () => {
    const period = await seedAcademicPeriod(fx, tenant);
    expect(await call(periodRouter.delete, { id: period.id }, { context: owner })).toEqual({
      deleted: true,
    });
  });
});

await testPermissionMatrix({
  name: "period",
  procedures: [
    {
      // D3: widened to `period:read | grade:read` so a teacher gets the GRD-01 lock pills and the
      // GRD-03 period select. `summary` and `get` stay on `period:read`.
      name: "period.list",
      permissions: { period: ["read"] },
      anyOf: [{ period: ["read"] }, { grade: ["read"] }],
      run: (context) => call(periodRouter.list, {}, { context }),
    },
    {
      name: "period.summary",
      permissions: { period: ["read"] },
      run: (context) => call(periodRouter.summary, undefined, { context }),
    },
    {
      name: "period.get",
      permissions: { period: ["read"] },
      run: (context) => call(periodRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "period.create",
      permissions: { period: ["create"] },
      run: (context) => call(periodRouter.create, input(), { context }),
    },
    {
      name: "period.update",
      permissions: { period: ["update"] },
      run: (context) => call(periodRouter.update, { id: "missing", ...input() }, { context }),
    },
    {
      name: "period.activate",
      permissions: { period: ["update"] },
      run: (context) => call(periodRouter.activate, { id: "missing" }, { context }),
    },
    {
      name: "period.delete",
      permissions: { period: ["delete"] },
      run: (context) => call(periodRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { periodId: string; periodName: string };
let foreignYearCounter = 0;
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  // The foreign tenant is shared across cases and each seed activates a period: use a fresh year.
  const academicYear = String(3000 + foreignYearCounter++);
  const period = await seedPeriod(fx, tenant, { academicYear });
  await fx.db
    .update(schema.academicPeriod)
    .set({ isActive: false })
    .where(eq(schema.academicPeriod.organizationId, tenant.orgId));
  await fx.db
    .update(schema.academicPeriod)
    .set({ isActive: true })
    .where(eq(schema.academicPeriod.id, period.id));
  return { periodId: period.id, periodName: period.name };
};
const untouched = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.academicPeriod)
    .where(eq(schema.academicPeriod.id, foreign.periodId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.periodName);
  expect(rows[0]?.isActive).toBe(true);
};

await testTenantIsolation({
  name: "period",
  cases: [
    isolationCase({
      name: "period.list never returns the other tenant's periods",
      seed,
      run: ({ context }) => call(periodRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.periodId, foreign.periodName],
    }),
    isolationCase({
      name: "period.summary never counts the other tenant's periods",
      seed,
      run: ({ context }) => call(periodRouter.summary, undefined, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.periodId, foreign.periodName],
    }),
    isolationCase({
      name: "period.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) => call(periodRouter.get, { id: foreign.periodId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "period.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          periodRouter.update,
          { id: foreign.periodId, ...input({ name: "Hackeado" }) },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
    isolationCase({
      name: "period.activate of a foreign id is NOT_FOUND and leaves both tenants' actives alone",
      seed,
      run: ({ context, foreign }) =>
        call(periodRouter.activate, { id: foreign.periodId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
    isolationCase({
      name: "period.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(periodRouter.delete, { id: foreign.periodId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
  ],
});
