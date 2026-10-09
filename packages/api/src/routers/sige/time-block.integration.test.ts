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
import { timeBlockRouter } from "./time-block";

/** `timeBlock.*` (sige/04 SCH-09/10, §3.4, §4, SCH-R11/R12): list, CRUD, overlap, in-use rules. */

const IN_USE_RETIME = "No se pueden cambiar los horarios de un bloque con clases programadas.";
const IN_USE_DELETE = "El bloque tiene clases programadas en el horario.";

const errorOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ORPCError<string, any>,
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

const setYear = (fx: SigeTestFixture, tenant: TestTenant, year: string) =>
  fx.db
    .insert(schema.institutionProfile)
    .values({ organizationId: tenant.orgId, currentAcademicYear: year })
    .onConflictDoUpdate({
      target: schema.institutionProfile.organizationId,
      set: { currentAcademicYear: year },
    });

const seedBlock = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  values: Partial<typeof schema.timeBlock.$inferInsert> = {},
) => {
  const [row] = await fx.db
    .insert(schema.timeBlock)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Bloque ${crypto.randomUUID().slice(0, 8)}`,
      startTime: "07:00",
      endTime: "08:00",
      orderNum: 1,
      shift: "Mañana",
      academicYear: "2026",
      ...values,
    })
    .returning();
  return row!;
};

/** A class that makes the block `07:00-08:00` of (campus, Mañana, 2026) "in use". */
const seedSlotFor = async (
  fx: SigeTestFixture,
  tenant: TestTenant,
  campusId: string,
  slot: { startTime?: string; endTime?: string; isActive?: boolean } = {},
) => {
  const [course] = await fx.db
    .insert(schema.course)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: `Curso ${crypto.randomUUID().slice(0, 8)}`,
      academicYear: "2026",
      shift: "Mañana",
    })
    .returning();
  const [subject] = await fx.db
    .insert(schema.subject)
    .values({ organizationId: tenant.orgId, name: `Materia ${crypto.randomUUID().slice(0, 8)}` })
    .returning();
  const [offering] = await fx.db
    .insert(schema.offering)
    .values({ organizationId: tenant.orgId, courseId: course!.id, subjectId: subject!.id })
    .returning();
  const [room] = await fx.db
    .insert(schema.classroom)
    .values({
      organizationId: tenant.orgId,
      campusId,
      name: "Aula",
      code: `C-${crypto.randomUUID().slice(0, 8)}`,
    })
    .returning();
  await fx.db.insert(schema.scheduleSlot).values({
    organizationId: tenant.orgId,
    offeringId: offering!.id,
    courseId: course!.id,
    classroomId: room!.id,
    dayOfWeek: 0,
    startTime: slot.startTime ?? "07:00",
    endTime: slot.endTime ?? "08:00",
    academicYear: "2026",
    isActive: slot.isActive ?? true,
  });
};

const blockInput = (campusId: string, values: Record<string, unknown> = {}) => ({
  campusId,
  name: "Bloque 1",
  shift: "Mañana" as const,
  startTime: "07:00",
  endTime: "08:00",
  orderNum: 1,
  isBreak: false,
  ...values,
});

await sigeSuite("timeBlock router", (fx) => {
  let tenant: TestTenant;
  let owner: Context;
  let audit: RecordingAuditLogger;

  test("provisions a tenant with academic year 2026", async () => {
    tenant = await fx.provisionTenant("Bloques", ["owner", "coordinator", "teacher"]);
    owner = await fx.contextFor(tenant.people.owner!, tenant);
    audit = owner.auditLogger as RecordingAuditLogger;
    await setYear(fx, tenant, "2026");
  });

  test("create stamps the institution's current year, returns the row; one audit event", async () => {
    const campus = await seedCampus(fx, tenant, { name: "Norte" });
    audit.reset();
    const created = await call(timeBlockRouter.create, blockInput(campus.id), { context: owner });
    expect(created).toMatchObject({
      campusId: campus.id,
      campusName: "Norte",
      name: "Bloque 1",
      shift: "Mañana",
      startTime: "07:00",
      endTime: "08:00",
      isBreak: false,
      orderNum: 1,
      academicYear: "2026",
      inUse: false,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "time_block.created",
      targetType: "time_block",
      targetId: created.id,
      organizationId: tenant.orgId,
    });
  });

  test("the year follows the institution's current year (D6); without a profile it is the calendar year", async () => {
    const t = await fx.provisionTenant("OtroAnio", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    const campus = await seedCampus(fx, t);
    // Sampled around the call so a New Year's Eve run still has exactly one right answer set.
    const yearBefore = new Date().getFullYear();
    const fallback = await call(timeBlockRouter.create, blockInput(campus.id), { context: ctx });
    const yearAfter = new Date().getFullYear();
    expect([...new Set([yearBefore, yearAfter])].map(String)).toContain(fallback.academicYear);
    await setYear(fx, t, "2031");
    const created = await call(
      timeBlockRouter.create,
      blockInput(campus.id, { name: "B2", startTime: "09:00", endTime: "10:00", orderNum: 2 }),
      { context: ctx },
    );
    expect(created.academicYear).toBe("2031");
  });

  test("create on a missing campus is NOT_FOUND; an inactive one is BAD_REQUEST (SCH-R12)", async () => {
    expect(
      (await errorOf(call(timeBlockRouter.create, blockInput("nope"), { context: owner })))?.code,
    ).toBe("NOT_FOUND");
    const inactive = await seedCampus(fx, tenant, { active: false });
    const error = await errorOf(
      call(timeBlockRouter.create, blockInput(inactive.id), { context: owner }),
    );
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe("La sede seleccionada no está activa.");
  });

  test("a block overlapping another of the same campus, shift and year is rejected", async () => {
    const campus = await seedCampus(fx, tenant);
    await seedBlock(fx, tenant, campus.id, {
      name: "Primero",
      startTime: "07:00",
      endTime: "08:00",
    });
    const error = await errorOf(
      call(
        timeBlockRouter.create,
        blockInput(campus.id, { name: "Choca", startTime: "07:30", endTime: "08:30", orderNum: 2 }),
        { context: owner },
      ),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("El bloque se superpone con Primero.");
    // Adjacent, another shift and another campus never overlap.
    await call(
      timeBlockRouter.create,
      blockInput(campus.id, { name: "Pegado", startTime: "08:00", endTime: "09:00", orderNum: 2 }),
      { context: owner },
    );
    await call(
      timeBlockRouter.create,
      blockInput(campus.id, {
        name: "Tarde",
        shift: "Tarde",
        startTime: "07:30",
        endTime: "08:30",
      }),
      { context: owner },
    );
    const other = await seedCampus(fx, tenant);
    await call(
      timeBlockRouter.create,
      blockInput(other.id, { name: "Otra", startTime: "07:30", endTime: "08:30" }),
      { context: owner },
    );
  });

  test("a block of another year does not overlap", async () => {
    const campus = await seedCampus(fx, tenant);
    await seedBlock(fx, tenant, campus.id, { academicYear: "2025", name: "Viejo" });
    const created = await call(timeBlockRouter.create, blockInput(campus.id, { name: "Nuevo" }), {
      context: owner,
    });
    expect(created.academicYear).toBe("2026");
  });

  test("the name is unique per campus, shift and year, case-insensitively", async () => {
    const campus = await seedCampus(fx, tenant);
    await seedBlock(fx, tenant, campus.id, {
      name: "recreo",
      startTime: "09:00",
      endTime: "09:30",
    });
    const error = await errorOf(
      call(
        timeBlockRouter.create,
        blockInput(campus.id, {
          name: "RECREO",
          startTime: "10:00",
          endTime: "10:30",
          orderNum: 2,
        }),
        { context: owner },
      ),
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toBe("Ya existe un bloque con este nombre en la sede y jornada.");
  });

  test("validation messages: times and order", async () => {
    const campus = await seedCampus(fx, tenant);
    const reversed = await errorOf(
      call(
        timeBlockRouter.create,
        blockInput(campus.id, { startTime: "09:00", endTime: "08:00" }),
        { context: owner },
      ),
    );
    expect(JSON.stringify(reversed?.data)).toContain(
      "La hora de fin debe ser posterior a la de inicio.",
    );
    const order = await errorOf(
      call(timeBlockRouter.create, blockInput(campus.id, { orderNum: 0 }), { context: owner }),
    );
    expect(JSON.stringify(order?.data)).toContain("El orden debe ser 1 o mayor.");
  });

  test("update changes fields and audits the changed ones only", async () => {
    const campus = await seedCampus(fx, tenant);
    const block = await seedBlock(fx, tenant, campus.id, { name: "Viejo" });
    audit.reset();
    const updated = await call(
      timeBlockRouter.update,
      { id: block.id, ...blockInput(campus.id, { name: "Nuevo" }) },
      { context: owner },
    );
    expect(updated.name).toBe("Nuevo");
    expect(updated.academicYear).toBe("2026");
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe("time_block.updated");
    const metadata = audit.events[0]?.metadata as { changes: unknown };
    expect(metadata.changes).toEqual({ name: { from: "Viejo", to: "Nuevo" } });
  });

  test("update excludes itself from the overlap check but not its neighbours", async () => {
    const campus = await seedCampus(fx, tenant);
    const first = await seedBlock(fx, tenant, campus.id, { name: "Uno", orderNum: 1 });
    await seedBlock(fx, tenant, campus.id, {
      name: "Dos",
      orderNum: 2,
      startTime: "08:00",
      endTime: "09:00",
    });
    const widened = await call(
      timeBlockRouter.update,
      { id: first.id, ...blockInput(campus.id, { name: "Uno", endTime: "07:45" }) },
      { context: owner },
    );
    expect(widened.endTime).toBe("07:45");
    const error = await errorOf(
      call(
        timeBlockRouter.update,
        { id: first.id, ...blockInput(campus.id, { name: "Uno", endTime: "08:30" }) },
        { context: owner },
      ),
    );
    expect(error?.message).toBe("El bloque se superpone con Dos.");
  });

  test("a block in use cannot change times, campus or shift, but can be renamed (SCH-R11)", async () => {
    const t = await fx.provisionTenant("EnUso", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    await setYear(fx, t, "2026");
    const campus = await seedCampus(fx, t);
    const other = await seedCampus(fx, t);
    const block = await seedBlock(fx, t, campus.id, { name: "Uso" });
    await seedSlotFor(fx, t, campus.id);
    const attempts: Record<string, unknown>[] = [
      { startTime: "07:15" },
      { endTime: "07:50" },
      { shift: "Tarde" },
      { campusId: other.id },
    ];
    for (const change of attempts) {
      const error = await errorOf(
        call(
          timeBlockRouter.update,
          { id: block.id, ...blockInput(campus.id, { name: "Uso", ...change }) },
          { context: ctx },
        ),
      );
      expect(error?.code).toBe("CONFLICT");
      expect(error?.message).toBe(IN_USE_RETIME);
    }
    const renamed = await call(
      timeBlockRouter.update,
      { id: block.id, ...blockInput(campus.id, { name: "Uso 2", orderNum: 3, isBreak: false }) },
      { context: ctx },
    );
    expect(renamed).toMatchObject({ name: "Uso 2", orderNum: 3, inUse: true });
  });

  test("inUse ignores inactive slots and slots with other times; delete follows it", async () => {
    const t = await fx.provisionTenant("EnUso2", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    await setYear(fx, t, "2026");
    const campus = await seedCampus(fx, t);
    const block = await seedBlock(fx, t, campus.id, { name: "Libre" });
    await seedSlotFor(fx, t, campus.id, { isActive: false });
    await seedSlotFor(fx, t, campus.id, { startTime: "09:00", endTime: "10:00" });
    expect((await call(timeBlockRouter.get, { id: block.id }, { context: ctx })).inUse).toBe(false);
    await seedSlotFor(fx, t, campus.id);
    expect((await call(timeBlockRouter.get, { id: block.id }, { context: ctx })).inUse).toBe(true);

    audit_reset(ctx);
    const error = await errorOf(call(timeBlockRouter.delete, { id: block.id }, { context: ctx }));
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe(IN_USE_DELETE);
    expect((ctx.auditLogger as RecordingAuditLogger).events).toHaveLength(0);
    expect(
      await fx.db.select().from(schema.timeBlock).where(eq(schema.timeBlock.id, block.id)),
    ).toHaveLength(1);
  });

  test("delete removes an unused block and snapshots it", async () => {
    const campus = await seedCampus(fx, tenant);
    const block = await seedBlock(fx, tenant, campus.id, { name: "Borrable" });
    audit.reset();
    expect(await call(timeBlockRouter.delete, { id: block.id }, { context: owner })).toEqual({
      deleted: true,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "time_block.deleted",
      metadata: { snapshot: { name: "Borrable" } },
    });
  });

  test("get/update/delete of a missing id is NOT_FOUND", async () => {
    const campus = await seedCampus(fx, tenant);
    for (const run of [
      () => call(timeBlockRouter.get, { id: "nope" }, { context: owner }),
      () =>
        call(timeBlockRouter.update, { id: "nope", ...blockInput(campus.id) }, { context: owner }),
      () => call(timeBlockRouter.delete, { id: "nope" }, { context: owner }),
    ]) {
      expect((await errorOf(run()))?.code).toBe("NOT_FOUND");
    }
  });

  test("update/delete lose a race to a concurrent delete: NOT_FOUND and no audit", async () => {
    for (const op of ["update", "delete"] as const) {
      const campus = await seedCampus(fx, tenant);
      const block = await seedBlock(fx, tenant, campus.id);
      const racing = {
        ...owner,
        db: racingDb(
          fx.db,
          async () => {
            await fx.db.delete(schema.timeBlock).where(eq(schema.timeBlock.id, block.id));
          },
          "transaction",
        ),
      } as Context;
      audit.reset();
      const run =
        op === "update"
          ? call(
              timeBlockRouter.update,
              { id: block.id, ...blockInput(campus.id, { name: block.name }) },
              { context: racing },
            )
          : call(timeBlockRouter.delete, { id: block.id }, { context: racing });
      expect((await errorOf(run))?.code).toBe("NOT_FOUND");
      expect(audit.events).toHaveLength(0);
    }
  });

  test("two concurrent overlapping creates: exactly one wins", async () => {
    const campus = await seedCampus(fx, tenant);
    const results = await Promise.all(
      ["Carrera A", "Carrera B"].map((name) =>
        errorOf(
          call(
            timeBlockRouter.create,
            blockInput(campus.id, { name, startTime: "11:00", endTime: "12:00" }),
            { context: owner },
          ),
        ),
      ),
    );
    expect(results.filter((error) => error === null)).toHaveLength(1);
    expect(results.find((error) => error !== null)?.code).toBe("CONFLICT");
  });

  test("list is bounded per campus, shift and year, ordered by campus, shift and order_num", async () => {
    const t = await fx.provisionTenant("ListaBloques", ["owner"]);
    const ctx = await fx.contextFor(t.people.owner!, t);
    await setYear(fx, t, "2026");
    const zeta = await seedCampus(fx, t, { name: "Zeta" });
    const alfa = await seedCampus(fx, t, { name: "Alfa" });
    await seedBlock(fx, t, zeta.id, { name: "Z1", orderNum: 1 });
    await seedBlock(fx, t, alfa.id, {
      name: "A2",
      orderNum: 2,
      startTime: "08:00",
      endTime: "09:00",
    });
    await seedBlock(fx, t, alfa.id, { name: "A1", orderNum: 1 });
    await seedBlock(fx, t, alfa.id, {
      name: "AT1",
      shift: "Tarde",
      orderNum: 1,
      startTime: "13:00",
      endTime: "14:00",
    });
    await seedBlock(fx, t, alfa.id, { name: "A-2025", academicYear: "2025" });

    const all = await call(timeBlockRouter.list, {}, { context: ctx });
    expect(all.map((row) => row.name)).toEqual(["A1", "A2", "AT1", "Z1"]);
    expect(all[0]).toMatchObject({ campusName: "Alfa", inUse: false, startTime: "07:00" });

    const byCampus = await call(timeBlockRouter.list, { campusId: zeta.id }, { context: ctx });
    expect(byCampus.map((row) => row.name)).toEqual(["Z1"]);
    const byShift = await call(timeBlockRouter.list, { shift: "Tarde" }, { context: ctx });
    expect(byShift.map((row) => row.name)).toEqual(["AT1"]);
    const byYear = await call(timeBlockRouter.list, { academicYear: "2025" }, { context: ctx });
    expect(byYear.map((row) => row.name)).toEqual(["A-2025"]);
  });
});

function audit_reset(ctx: Context) {
  (ctx.auditLogger as RecordingAuditLogger).reset();
}

await testPermissionMatrix({
  name: "timeBlock",
  procedures: [
    {
      name: "timeBlock.list",
      permissions: { time_block: ["read"] },
      run: (context) => call(timeBlockRouter.list, {}, { context }),
    },
    {
      name: "timeBlock.get",
      permissions: { time_block: ["read"] },
      run: (context) => call(timeBlockRouter.get, { id: "missing" }, { context }),
    },
    {
      name: "timeBlock.create",
      permissions: { time_block: ["create"] },
      run: (context) => call(timeBlockRouter.create, blockInput("missing"), { context }),
    },
    {
      name: "timeBlock.update",
      permissions: { time_block: ["update"] },
      run: (context) =>
        call(timeBlockRouter.update, { id: "missing", ...blockInput("missing") }, { context }),
    },
    {
      name: "timeBlock.delete",
      permissions: { time_block: ["delete"] },
      run: (context) => call(timeBlockRouter.delete, { id: "missing" }, { context }),
    },
  ],
});

type Seed = { campusId: string; blockId: string; blockName: string };
const seed = async (tenant: TestTenant, fx: SigeTestFixture): Promise<Seed> => {
  const campus = await seedCampus(fx, tenant);
  const block = await seedBlock(fx, tenant, campus.id);
  return { campusId: campus.id, blockId: block.id, blockName: block.name };
};
const untouched = async (foreign: Seed, fx: SigeTestFixture) => {
  const rows = await fx.db
    .select()
    .from(schema.timeBlock)
    .where(eq(schema.timeBlock.id, foreign.blockId));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe(foreign.blockName);
};

await testTenantIsolation({
  name: "timeBlock",
  cases: [
    isolationCase({
      name: "timeBlock.list never returns the other tenant's blocks",
      seed,
      run: ({ context }) => call(timeBlockRouter.list, {}, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.blockId, foreign.blockName, foreign.campusId],
    }),
    isolationCase({
      name: "timeBlock.list filtered by a foreign campus returns nothing",
      seed,
      run: ({ context, foreign }) =>
        call(timeBlockRouter.list, { campusId: foreign.campusId }, { context }),
      expectation: "noLeak",
      foreignIds: (foreign) => [foreign.blockId, foreign.blockName],
    }),
    isolationCase({
      name: "timeBlock.get of a foreign id is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(timeBlockRouter.get, { id: foreign.blockId }, { context }),
      expectation: "notFound",
    }),
    isolationCase({
      name: "timeBlock.create under a foreign campus is NOT_FOUND",
      seed,
      run: ({ context, foreign }) =>
        call(timeBlockRouter.create, blockInput(foreign.campusId, { name: "Intruso" }), {
          context,
        }),
      expectation: "notFound",
      verifyForeignUnchanged: async (foreign, fx) => {
        const rows = await fx.db
          .select()
          .from(schema.timeBlock)
          .where(eq(schema.timeBlock.campusId, foreign.campusId));
        expect(rows).toHaveLength(1);
      },
    }),
    isolationCase({
      name: "timeBlock.update of a foreign id is NOT_FOUND and changes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(
          timeBlockRouter.update,
          { id: foreign.blockId, ...blockInput(foreign.campusId, { name: "Hackeado" }) },
          { context },
        ),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
    isolationCase({
      name: "timeBlock.delete of a foreign id is NOT_FOUND and deletes nothing",
      seed,
      run: ({ context, foreign }) =>
        call(timeBlockRouter.delete, { id: foreign.blockId }, { context }),
      expectation: "notFound",
      verifyForeignUnchanged: untouched,
    }),
  ],
});
